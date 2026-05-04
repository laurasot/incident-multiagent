import * as iam from "aws-cdk-lib/aws-iam";

export const apiPolicy = new iam.PolicyStatement({
  actions: ["execute-api:*"],
  resources: ["*"],
});
