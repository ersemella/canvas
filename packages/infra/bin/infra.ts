#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { CanvasStack } from '../lib/canvas-stack';

const app = new cdk.App();
new CanvasStack(app, 'CanvasStack');
app.synth();
