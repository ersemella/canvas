import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import {NodejsFunction, OutputFormat} from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigwv2 from '@aws-cdk/aws-apigatewayv2-alpha';
import * as integrations from '@aws-cdk/aws-apigatewayv2-integrations-alpha';
import * as apigwv2cfn from 'aws-cdk-lib/aws-apigatewayv2';
import {Construct} from 'constructs';

const handlersRoot = path.join(__dirname, '../../handlers/src');

export class CanvasStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // --- DynamoDB: single-table design ---
    // Entity patterns:
    //   Room:       pk=ROOM#{roomId}  sk=METADATA
    //   Connection: pk=ROOM#{roomId}  sk=CONN#{connectionId}  gsi1pk=CONN#{connectionId}
    const table = new dynamodb.Table(this, 'RoomTable', {
      partitionKey: {name: 'pk', type: dynamodb.AttributeType.STRING},
      sortKey: {name: 'sk', type: dynamodb.AttributeType.STRING},
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // GSI1: lets WS disconnect handler look up room by connectionId
    table.addGlobalSecondaryIndex({
      indexName: 'gsi1',
      partitionKey: {name: 'gsi1pk', type: dynamodb.AttributeType.STRING},
    });

    const bundling = {
      format: OutputFormat.CJS,
      target: 'node20',
      externalModules: ['@aws-sdk/*'],
    };

    const commonEnv = {TABLE_NAME: table.tableName};

    // --- HTTP Lambda functions ---
    const createRoom = new NodejsFunction(this, 'CreateRoom', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(handlersRoot, 'handlers/createRoom.ts'),
      handler: 'handler',
      environment: {...commonEnv, GAME_TYPE: 'poker'},
      bundling,
    });

    const getRoom = new NodejsFunction(this, 'GetRoom', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(handlersRoot, 'handlers/getRoom.ts'),
      handler: 'handler',
      environment: commonEnv,
      bundling,
    });

    const joinRoom = new NodejsFunction(this, 'JoinRoom', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(handlersRoot, 'handlers/joinRoom.ts'),
      handler: 'handler',
      environment: commonEnv, // WS_ENDPOINT injected below after stage is created
      bundling,
    });

    // --- WebSocket Lambda functions (WS_ENDPOINT added after stage is created) ---
    const wsConnect = new NodejsFunction(this, 'WsConnect', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(handlersRoot, 'handlers/wsConnect.ts'),
      handler: 'handler',
      environment: commonEnv,
      bundling,
    });

    const wsDisconnect = new NodejsFunction(this, 'WsDisconnect', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(handlersRoot, 'handlers/wsDisconnect.ts'),
      handler: 'handler',
      environment: commonEnv,
      bundling,
    });

    const wsDefault = new NodejsFunction(this, 'WsDefault', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(handlersRoot, 'handlers/wsDefault.ts'),
      handler: 'handler',
      environment: commonEnv,
      bundling,
    });

    // Grant all functions read/write access to the table
    for (const fn of [createRoom, getRoom, joinRoom, wsConnect, wsDisconnect, wsDefault]) {
      table.grantReadWriteData(fn);
    }

    // --- HTTP API ---
    const httpApi = new apigwv2.HttpApi(this, 'HttpApi', {
      corsPreflight: {
        allowOrigins: ['*'],
        allowMethods: [apigwv2.CorsHttpMethod.ANY],
        allowHeaders: ['Content-Type'],
      },
    });

    // Stage-level throttle: 50 req/s sustained, burst of 100.
    // Applies to all routes; sufficient to block room-spam while
    // allowing normal concurrent players.
    const defaultStage = httpApi.defaultStage?.node.defaultChild as apigwv2cfn.CfnStage;
    defaultStage.defaultRouteSettings = {
      throttlingRateLimit: 50,
      throttlingBurstLimit: 100,
    };

    httpApi.addRoutes({
      path: '/rooms',
      methods: [apigwv2.HttpMethod.POST],
      integration: new integrations.HttpLambdaIntegration('CreateRoomInteg', createRoom),
    });

    httpApi.addRoutes({
      path: '/rooms/{roomId}',
      methods: [apigwv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration('GetRoomInteg', getRoom),
    });

    httpApi.addRoutes({
      path: '/rooms/{roomId}/join',
      methods: [apigwv2.HttpMethod.POST],
      integration: new integrations.HttpLambdaIntegration('JoinRoomInteg', joinRoom),
    });

    // --- WebSocket API ---
    const wsApi = new apigwv2.WebSocketApi(this, 'WsApi', {
      connectRouteOptions: {
        integration: new integrations.WebSocketLambdaIntegration('WsConnectInteg', wsConnect),
      },
      disconnectRouteOptions: {
        integration: new integrations.WebSocketLambdaIntegration('WsDisconnectInteg', wsDisconnect),
      },
      defaultRouteOptions: {
        integration: new integrations.WebSocketLambdaIntegration('WsDefaultInteg', wsDefault),
      },
    });

    const wsStage = new apigwv2.WebSocketStage(this, 'WsStage', {
      webSocketApi: wsApi,
      stageName: 'prod',
      autoDeploy: true,
    });

    // Inject WS_ENDPOINT now that stage URL is available
    for (const fn of [joinRoom, wsConnect, wsDisconnect, wsDefault]) {
      fn.addEnvironment('WS_ENDPOINT', wsStage.callbackUrl);
    }

    // Grant WS lambdas permission to send messages back to connections
    const manageConnectionsArn = `arn:aws:execute-api:${this.region}:${this.account}:${wsApi.apiId}/${wsStage.stageName}/POST/@connections/*`;
    const manageConnectionsPolicy = new iam.PolicyStatement({
      actions: ['execute-api:ManageConnections'],
      resources: [manageConnectionsArn],
    });
    for (const fn of [wsConnect, wsDisconnect, wsDefault]) {
      fn.addToRolePolicy(manageConnectionsPolicy);
    }

    // --- Outputs ---
    new cdk.CfnOutput(this, 'HttpApiUrl', {value: httpApi.url ?? ''});
    new cdk.CfnOutput(this, 'WsApiUrl', {value: wsStage.url});
    new cdk.CfnOutput(this, 'TableName', {value: table.tableName});
  }
}
