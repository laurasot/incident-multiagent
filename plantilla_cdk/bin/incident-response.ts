#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { IncidentResponseStack } from '../lib/stack/incident-response-stack';
import { config } from '../config/env-config';

const app = new cdk.App();
const { env, params } = config;
const { envName, projectName } = params;
const stackName = `${projectName}-stack-${envName}`;

new IncidentResponseStack(app, stackName, { 
  params, 
  env,
  stackName,
});

// Add global tags
cdk.Tags.of(app).add('Project', projectName);
cdk.Tags.of(app).add('Environment', envName);
cdk.Tags.of(app).add('ManagedBy', 'AWS-CDK');
