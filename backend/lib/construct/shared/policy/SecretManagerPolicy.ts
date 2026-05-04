import * as iam from "aws-cdk-lib/aws-iam";

export const secretManagerPolicy = new iam.PolicyStatement({
  actions: ["secretsmanager:*"],
  resources: ["*"],
});
