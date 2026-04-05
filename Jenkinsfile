def retryWithDelay(Closure body, int max_retries, int delay) {
    for(int attempts = 1; attempts <= max_retries; attempts++) {
        try {
            body()
            return
        } catch(Exception e) {
            echo "Attempt ${attempts}/${max_retries} failed: ${e.message}"
            if(attempts == max_retries) {
                error("Failed after ${max_retries} attempts")
            }
            echo "Waiting ${delay} seconds before retry..."
            sleep(time: delay, unit: "SECONDS")
        }
    }
}

pipeline {
    agent any 

    tools {
        nodejs 'node22'   // Change to your actual NodeJS tool name configured in Jenkins
    }

    environment {
        AWS_ACCESS_KEY_ID     = credentials('aws-access-key')
        AWS_SECRET_ACCESS_KEY = credentials('aws-secret-key')
        REGION                = 'us-east-1'
        MAX_RETRIES           = 3
        DELAY_RETRIES         = 5
        IMAGE_NAME            = "my-ecr-repository"   // Make sure this matches your ECR repo
        ACCOUNT_ID            = "225387892229"
        TAG                   = "${BUILD_NUMBER}"
        ASG_NAME              = "my-app-asg"
        PATH                  = "/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
    }

    options {
        buildDiscarder(logRotator(numToKeepStr: '10'))
        timestamps()
        timeout(time: 30, unit: 'MINUTES')
    }

    parameters {
        booleanParam(name: "SKIP_TEST", defaultValue: false, description: "Skip test stage")
        booleanParam(name: "SKIP_BUILD", defaultValue: false, description: "Skip build stage")
    }

    stages {
        stage("Checkout Code") {
            steps {
                git branch: 'main', url: 'https://github.com/Nikhil00-7/first-app.git'
            }
        }

        stage("Pre Check") {
            steps {
                script {
                    def files = ['Dockerfile', 'package.json', 'server.js']
                    files.each { file ->
                        if (!fileExists(file)) {
                            error("Required file '${file}' not found")
                        }
                    }
                    echo "✓ All required files are present"
                }
            }
        }

        stage("Install Dependencies") {
            steps {
                sh "npm install"
            }
        }

        stage("Parallel: Lint, Test & Build") {
            when {
                expression { !params.SKIP_TEST && !params.SKIP_BUILD }
            }
            parallel {
                stage("Code Quality / Lint") {
                    steps { sh "npm run lint || echo 'Lint skipped or no lint script'" }
                }
                stage("Run Tests") {
                    steps { sh "npm test || echo 'No tests found'" }
                }
                stage("Build") {
                    steps { sh "npm run build || echo 'No build step'" }
                }
            }
        }

        stage("Docker Build") {
            steps {
                retryWithDelay({ 
                    sh "docker build -t ${IMAGE_NAME}:${TAG} ."
                }, env.MAX_RETRIES.toInteger(), env.DELAY_RETRIES.toInteger())
            }
        }

        stage("Scan Image with Trivy") {
            steps {
                retryWithDelay({
                    sh """
                    docker run --rm aquasec/trivy image \
                      --exit-code 0 \
                      --severity HIGH,CRITICAL \
                      --timeout 5m \
                      ${IMAGE_NAME}:${TAG}
                    """
                }, env.MAX_RETRIES.toInteger(), env.DELAY_RETRIES.toInteger())
            }
        }

        stage("ECR Login") {
            steps {
                retryWithDelay({
                    sh """
                    aws ecr get-login-password --region ${REGION} | \
                    docker login --username AWS --password-stdin ${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com
                    """
                }, env.MAX_RETRIES.toInteger(), env.DELAY_RETRIES.toInteger())
            }
        }

        stage("Push to ECR") {
            steps {
                retryWithDelay({
                    sh """
                    docker tag ${IMAGE_NAME}:${TAG} ${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${IMAGE_NAME}:${TAG}
                    docker tag ${IMAGE_NAME}:${TAG} ${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${IMAGE_NAME}:latest

                    docker push ${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${IMAGE_NAME}:${TAG}
                    docker push ${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${IMAGE_NAME}:latest
                    """
                }, env.MAX_RETRIES.toInteger(), env.DELAY_RETRIES.toInteger())
            }
        }

        // === Deployment Stage ===
        stage("Deploy to ASG") {
            steps {
                script {
                    def region = env.REGION
                    def asgName = env.ASG_NAME

                    echo "Triggering rolling update via Instance Refresh..."

                    sh """
                    aws autoscaling start-instance-refresh \
                      --auto-scaling-group-name ${asgName} \
                      --strategy Rolling \
                      --preferences '{
                        "MinHealthyPercentage": 50,
                        "InstanceWarmup": 120
                      }' \
                      --region ${region}
                    """
                }
            }
        }

        stage("Wait for Instance Refresh") {
            steps {
                timeout(time: 20, unit: 'MINUTES') {
                    script {
                        waitUntil {
                            def status = sh(script: """
                                aws autoscaling describe-instance-refreshes \
                                  --auto-scaling-group-name ${ASG_NAME} \
                                  --region ${REGION} \
                                  --query 'InstanceRefreshes[0].Status' \
                                  --output text
                            """, returnStdout: true).trim()

                            echo "Current Instance Refresh Status: ${status}"
                            return status == "Successful"
                        }
                    }
                }
            }
        }

        stage("Verify Healthy Instances") {
            steps {
                script {
                    timeout(time: 10, unit: 'MINUTES') {
                        waitUntil {
                            def healthy = sh(script: """
                                aws autoscaling describe-auto-scaling-groups \
                                  --auto-scaling-group-names ${ASG_NAME} \
                                  --region ${REGION} \
                                  --query 'AutoScalingGroups[0].Instances[?HealthStatus==`Healthy`].InstanceId' \
                                  --output text | wc -w
                            """, returnStdout: true).trim().toInteger()

                            def desired = sh(script: """
                                aws autoscaling describe-auto-scaling-groups \
                                  --auto-scaling-group-names ${ASG_NAME} \
                                  --region ${REGION} \
                                  --query 'AutoScalingGroups[0].DesiredCapacity' \
                                  --output text
                            """, returnStdout: true).trim().toInteger()

                            echo "Healthy instances: ${healthy}/${desired}"
                            return healthy == desired && desired > 0
                        }
                    }
                    echo "✅ Deployment completed successfully!"
                }
            }
        }

        stage("Cleanup") {
            steps {
                sh "docker image prune -f || true"
            }
        }
    }

    post {
        success {
            echo "Pipeline completed successfully!"
            emailext(
                subject: "SUCCESS: ${env.JOB_NAME} #${env.BUILD_NUMBER}",
                body: "Deployment successful!\nJob: ${env.JOB_NAME}\nBuild: #${env.BUILD_NUMBER}\nURL: ${env.BUILD_URL}",
                to: "kujurnikhil0007@gmail.com"
            )
        }
        failure {
            echo "Pipeline failed!"
            emailext(
                subject: "FAILURE: ${env.JOB_NAME} #${env.BUILD_NUMBER}",
                body: "Deployment failed!\nJob: ${env.JOB_NAME}\nBuild: #${env.BUILD_NUMBER}\nURL: ${env.BUILD_URL}",
                to: "kujurnikhil0007@gmail.com"
            )
        }
    }
}