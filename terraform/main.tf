terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "us-east-1"
}

variable "bucket_name" {
  type        = string
  description = "Name of the S3 bucket (must be globally unique)"
}

variable "source_email" {
  type        = string
  description = "Verified SES email address to send notifications from"
  default     = "mohibkohi@gmail.com" # Placeholder, user needs to verify or override
}

resource "aws_ses_email_identity" "source" {
  email = var.source_email
}

# --- Existing S3 Bucket ---
resource "aws_s3_bucket" "website" {
  bucket = var.bucket_name
}

resource "aws_s3_bucket_website_configuration" "website" {
  bucket = aws_s3_bucket.website.id
  index_document {
    suffix = "index.html"
  }
  error_document {
    key = "index.html"
  }
}

resource "aws_s3_bucket_public_access_block" "website" {
  bucket = aws_s3_bucket.website.id
  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_policy" "website" {
  bucket = aws_s3_bucket.website.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "PublicReadGetObject"
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.website.arn}/*"
      },
    ]
  })
  depends_on = [aws_s3_bucket_public_access_block.website]
}

# --- DynamoDB Table: Subscriptions ---
resource "aws_dynamodb_table" "subscriptions" {
  name           = "EarningsSubscriptions"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "email"
  range_key      = "ticker"

  attribute {
    name = "email"
    type = "S"
  }

  attribute {
    name = "ticker"
    type = "S"
  }
}

# --- DynamoDB Table: Users ---
resource "aws_dynamodb_table" "users" {
  name           = "EarningsUsers"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "email"

  attribute {
    name = "email"
    type = "S"
  }
}

# --- IAM Role for Lambdas ---
resource "aws_iam_role" "lambda_role" {
  name = "earnings_lambda_role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

# IAM Policy for DynamoDB & Logs & SES
resource "aws_iam_role_policy" "lambda_policy" {
  name = "earnings_lambda_policy"
  role = aws_iam_role.lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:GetItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Scan",
          "dynamodb:Query"
        ]
        Resource = [
          aws_dynamodb_table.subscriptions.arn,
          aws_dynamodb_table.users.arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "ses:SendEmail",
          "ses:SendRawEmail"
        ]
        Resource = "*" 
      }
    ]
  })
}

# --- Lambda: Subscribe ---
data "archive_file" "subscribe_zip" {
  type        = "zip"
  source_dir  = "${path.module}/src/lambdas/subscribe"
  output_path = "${path.module}/dist/subscribe.zip"
}

resource "aws_lambda_function" "subscribe" {
  filename         = data.archive_file.subscribe_zip.output_path
  function_name    = "EarningsSubscribe"
  role             = aws_iam_role.lambda_role.arn
  handler          = "index.handler"
  runtime          = "nodejs18.x"
  source_code_hash = data.archive_file.subscribe_zip.output_base64sha256

  environment {
    variables = {
      TABLE_NAME   = aws_dynamodb_table.subscriptions.name
      SOURCE_EMAIL = var.source_email
    }
  }
}

# --- Lambda: Signup ---
data "archive_file" "signup_zip" {
  type        = "zip"
  source_dir  = "${path.module}/src/lambdas/signup"
  output_path = "${path.module}/dist/signup.zip"
}

resource "aws_lambda_function" "signup" {
  filename         = data.archive_file.signup_zip.output_path
  function_name    = "EarningsSignup"
  role             = aws_iam_role.lambda_role.arn
  handler          = "index.handler"
  runtime          = "nodejs18.x"
  source_code_hash = data.archive_file.signup_zip.output_base64sha256

  environment {
    variables = {
      USERS_TABLE  = aws_dynamodb_table.users.name
      SOURCE_EMAIL = var.source_email
    }
  }
}

# --- Lambda: Login ---
data "archive_file" "login_zip" {
  type        = "zip"
  source_dir  = "${path.module}/src/lambdas/login"
  output_path = "${path.module}/dist/login.zip"
}

resource "aws_lambda_function" "login" {
  filename         = data.archive_file.login_zip.output_path
  function_name    = "EarningsLogin"
  role             = aws_iam_role.lambda_role.arn
  handler          = "index.handler"
  runtime          = "nodejs18.x"
  source_code_hash = data.archive_file.login_zip.output_base64sha256

  environment {
    variables = {
      USERS_TABLE = aws_dynamodb_table.users.name
    }
  }
}

# --- Lambda: Get Subscriptions ---
data "archive_file" "get_subs_zip" {
  type        = "zip"
  source_dir  = "${path.module}/src/lambdas/getSubscriptions"
  output_path = "${path.module}/dist/getSubscriptions.zip"
}

resource "aws_lambda_function" "get_subs" {
  filename         = data.archive_file.get_subs_zip.output_path
  function_name    = "EarningsGetSubscriptions"
  role             = aws_iam_role.lambda_role.arn
  handler          = "index.handler"
  runtime          = "nodejs18.x"
  source_code_hash = data.archive_file.get_subs_zip.output_base64sha256

  environment {
    variables = {
      TABLE_NAME = aws_dynamodb_table.subscriptions.name
    }
  }
}

# --- Lambda: Unsubscribe ---
data "archive_file" "unsubscribe_zip" {
  type        = "zip"
  source_dir  = "${path.module}/src/lambdas/unsubscribe"
  output_path = "${path.module}/dist/unsubscribe.zip"
}

resource "aws_lambda_function" "unsubscribe" {
  filename         = data.archive_file.unsubscribe_zip.output_path
  function_name    = "EarningsUnsubscribe"
  role             = aws_iam_role.lambda_role.arn
  handler          = "index.handler"
  runtime          = "nodejs18.x"
  source_code_hash = data.archive_file.unsubscribe_zip.output_base64sha256

  environment {
    variables = {
      TABLE_NAME = aws_dynamodb_table.subscriptions.name
    }
  }
}

# --- Lambda: Processor ---
data "archive_file" "processor_zip" {
  type        = "zip"
  source_dir  = "${path.module}/src/lambdas/processor"
  output_path = "${path.module}/dist/processor.zip"
}

resource "aws_lambda_function" "processor" {
  filename         = data.archive_file.processor_zip.output_path
  function_name    = "EarningsProcessor"
  role             = aws_iam_role.lambda_role.arn
  handler          = "index.handler"
  runtime          = "nodejs18.x"
  source_code_hash = data.archive_file.processor_zip.output_base64sha256
  timeout          = 60 # Give it a minute

  environment {
    variables = {
      TABLE_NAME   = aws_dynamodb_table.subscriptions.name
      SOURCE_EMAIL = var.source_email
    }
  }
}

# --- API Gateway (HTTP API) ---
resource "aws_apigatewayv2_api" "earnings_api" {
  name          = "EarningsAPI"
  protocol_type = "HTTP"
  cors_configuration {
    allow_origins = ["*"]
    allow_methods = ["POST", "GET", "DELETE", "OPTIONS"]
    allow_headers = ["content-type", "authorization"]
  }
}

resource "aws_apigatewayv2_stage" "prod" {
  api_id = aws_apigatewayv2_api.earnings_api.id
  name   = "$default"
  auto_deploy = true
}

# --- integrations & Routes ---

# Subscribe
resource "aws_apigatewayv2_integration" "subscribe_integration" {
  api_id           = aws_apigatewayv2_api.earnings_api.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.subscribe.invoke_arn
}

resource "aws_apigatewayv2_route" "subscribe_route" {
  api_id    = aws_apigatewayv2_api.earnings_api.id
  route_key = "POST /subscribe"
  target    = "integrations/${aws_apigatewayv2_integration.subscribe_integration.id}"
}

# Signup
resource "aws_apigatewayv2_integration" "signup_integration" {
  api_id           = aws_apigatewayv2_api.earnings_api.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.signup.invoke_arn
}

resource "aws_apigatewayv2_route" "signup_route" {
  api_id    = aws_apigatewayv2_api.earnings_api.id
  route_key = "POST /signup"
  target    = "integrations/${aws_apigatewayv2_integration.signup_integration.id}"
}

# Login
resource "aws_apigatewayv2_integration" "login_integration" {
  api_id           = aws_apigatewayv2_api.earnings_api.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.login.invoke_arn
}

resource "aws_apigatewayv2_route" "login_route" {
  api_id    = aws_apigatewayv2_api.earnings_api.id
  route_key = "POST /login"
  target    = "integrations/${aws_apigatewayv2_integration.login_integration.id}"
}

# Get Subscriptions
resource "aws_apigatewayv2_integration" "get_subs_integration" {
  api_id           = aws_apigatewayv2_api.earnings_api.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.get_subs.invoke_arn
}

resource "aws_apigatewayv2_route" "get_subs_route" {
  api_id    = aws_apigatewayv2_api.earnings_api.id
  route_key = "GET /subscriptions"
  target    = "integrations/${aws_apigatewayv2_integration.get_subs_integration.id}"
}

# Unsubscribe
resource "aws_apigatewayv2_integration" "unsubscribe_integration" {
  api_id           = aws_apigatewayv2_api.earnings_api.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.unsubscribe.invoke_arn
}

resource "aws_apigatewayv2_route" "unsubscribe_route" {
  api_id    = aws_apigatewayv2_api.earnings_api.id
  route_key = "POST /unsubscribe"
  target    = "integrations/${aws_apigatewayv2_integration.unsubscribe_integration.id}"
}

# --- Permissions ---

resource "aws_lambda_permission" "api_gateway_subscribe" {
  statement_id  = "AllowExecutionFromAPIGatewaySubscribe"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.subscribe.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.earnings_api.execution_arn}/*/*/subscribe"
}

resource "aws_lambda_permission" "api_gateway_signup" {
  statement_id  = "AllowExecutionFromAPIGatewaySignup"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.signup.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.earnings_api.execution_arn}/*/*/signup"
}

resource "aws_lambda_permission" "api_gateway_login" {
  statement_id  = "AllowExecutionFromAPIGatewayLogin"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.login.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.earnings_api.execution_arn}/*/*/login"
}

resource "aws_lambda_permission" "api_gateway_get_subs" {
  statement_id  = "AllowExecutionFromAPIGatewayGetSubs"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.get_subs.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.earnings_api.execution_arn}/*/*/subscriptions"
}

resource "aws_lambda_permission" "api_gateway_unsubscribe" {
  statement_id  = "AllowExecutionFromAPIGatewayUnsubscribe"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.unsubscribe.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.earnings_api.execution_arn}/*/*/unsubscribe"
}

# --- EventBridge Scheduler (Daily) ---
resource "aws_cloudwatch_event_rule" "daily_earnings_check" {
  name                = "daily-earnings-check"
  description         = "Triggers Earnings Processor daily"
  schedule_expression = "cron(0 12 * * ? *)" # Run at 12:00 UTC (Early morning US)
}

resource "aws_cloudwatch_event_target" "lambda_target" {
  rule      = aws_cloudwatch_event_rule.daily_earnings_check.name
  target_id = "EarningsProcessor"
  arn       = aws_lambda_function.processor.arn
}

resource "aws_lambda_permission" "allow_eventbridge" {
  statement_id  = "AllowExecutionFromEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.processor.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.daily_earnings_check.arn
}

# --- Outputs ---
output "website_endpoint" {
  value = aws_s3_bucket_website_configuration.website.website_endpoint
}

output "api_endpoint" {
  value = aws_apigatewayv2_api.earnings_api.api_endpoint
}
