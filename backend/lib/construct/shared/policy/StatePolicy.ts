import * as iam from "aws-cdk-lib/aws-iam";

export const statePolicy = new iam.PolicyStatement({
  actions: ["states:*"],
  resources: ["*"],
});
