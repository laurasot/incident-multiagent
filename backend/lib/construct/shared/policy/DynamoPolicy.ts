import * as iam from "aws-cdk-lib/aws-iam";

export const dynamoPolicy = new iam.PolicyStatement({
  actions: ["dynamodb:*"],
  resources: ["*"],
});
