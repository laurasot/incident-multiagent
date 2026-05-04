import * as iam from "aws-cdk-lib/aws-iam";

export const lambdaPolicy = new iam.PolicyStatement({
  actions: ["lambda:*"],
  resources: ["*"],
}); 