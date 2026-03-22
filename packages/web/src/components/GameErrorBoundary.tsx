import {Component} from 'react';
import type {ReactNode} from 'react';
import {Link} from 'react-router-dom';
import {Center, Stack, Text, Button, Code} from '@mantine/core';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class GameErrorBoundary extends Component<Props, State> {
  state: State = {error: null};

  static getDerivedStateFromError(error: Error): State {
    return {error};
  }

  render() {
    if (this.state.error) {
      return (
        <Center h={300}>
          <Stack align="center" gap="sm" maw={480}>
            <Text ff="monospace" fw="bold" fz="lg" c="red.4">Something went wrong</Text>
            <Text c="dimmed" ta="center" fz="sm">
              The game crashed unexpectedly. This is likely a bug.
            </Text>
            <Code block fz="xs" maw={480} style={{maxHeight: 120, overflow: 'auto'}}>
              {this.state.error.message}
            </Code>
            <Button component={Link} to="/" mt="xs" variant="light">
              Back to home
            </Button>
          </Stack>
        </Center>
      );
    }

    return this.props.children;
  }
}
