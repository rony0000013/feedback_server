import * as cdk from 'aws-cdk-lib'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as apigw from 'aws-cdk-lib/aws-apigateway'
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'

export class MyAppStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    const fn = new NodejsFunction(this, 'feedback-server', {
      entry: 'main.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_LATEST,
    })
    fn.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
    })
    new apigw.LambdaRestApi(this, 'myapi', {
      handler: fn,
    })
  }
}