// Jenkins Pipeline for Node.js CI/CD with AWS ECR and EC2 Auto Scaling Group Deployment
//
// Prerequisites:
// 1. Jenkins credentials: 'aws-access-key-id' and 'aws-secret-access-key'
// 2. AWS ECR repository: my-ecr-repository
// 3. EC2 Launch Template: my-app-launch-template (with user data script that pulls 'latest' image)
// 4. Auto Scaling Group: my-app-asg (attached to ALB target group)
// 5. ALB configured with target group for port 80
// 6. IAM permissions for EC2, ECR, Auto Scaling operations
//
// Deployment Strategy:
// - Terraform creates ASG with desired_capacity = 0 (no instances launched initially)
// - First Jenkins run: sets desired_capacity = 2, launches instances that pull 'latest' image
// - Subsequent Jenkins runs: triggers instance refresh for rolling deployment
// - New instances always pull 'latest' image via launch template user data script
// - ALB handles traffic distribution and health checks
//
// User Data Script (in launch template) - Recommended improvements:
// #!/bin/bash
// set -e
//
// REGION="us-east-1"
// ACCOUNT_ID="225387892229"
// REPO="my-ecr-repository"
// TAG="latest"
// MAX_RETRIES=10
// RETRY_DELAY=30
//
// echo "Installing dependencies..."
// yum update -y
// amazon-linux-extras install docker -y
// service docker start
// usermod -a -G docker ec2-user
//
// echo "Logging into ECR with retries..."
// for i in \$(seq 1 \$MAX_RETRIES); do
//   if aws ecr get-login-password --region \$REGION | docker login --username AWS --password-stdin \$ACCOUNT_ID.dkr.ecr.\$REGION.amazonaws.com; then
//     echo "ECR login successful"
//     break
//   else
//     echo "ECR login attempt \$i/\$MAX_RETRIES failed, retrying in \$RETRY_DELAY seconds..."
//     sleep \$RETRY_DELAY
//   fi
// done
//
// echo "Pulling latest image with retries..."
// for i in \$(seq 1 \$MAX_RETRIES); do
//   if docker pull \$ACCOUNT_ID.dkr.ecr.\$REGION.amazonaws.com/\$REPO:\$TAG; then
//     echo "Image pull successful"
//     break
//   else
//     echo "Image pull attempt \$i/\$MAX_RETRIES failed, retrying in \$RETRY_DELAY seconds..."
//     sleep \$RETRY_DELAY
//   fi
// done
//
// echo "Stopping old container (if exists)..."
// docker rm -f my-app || true
//
// echo "Running new container..."
// docker run -d -p 3000:3000 --name my-app \$ACCOUNT_ID.dkr.ecr.\$REGION.amazonaws.com/\$REPO:\$TAG
//
// echo "Deployment successful and running on port 3000"

def retryWithDelay (closure body , int  max_retries , int delay){
    for(int attempts = 1 ; attempts<= max_retries ; attempts++){
        try{
          body()
          return
        }catch(Exception e){
          echo "Attempts ${attempts}/${max_retries}  failed"

          if(attempts == max_retries){
            error("failed to build after ${max_retries}")
          }
          echo "waiting ${delay} seconds for next retry...."
          sleep(time: delay , unit:"SECONDS")
        }
    }
}

pipeline {

    agent any 

    tools {
        node 'nodejs'
    }

    environment {
        AWS_ACCESS_KEY_ID = credentials('aws-access-key')
        AWS_SECRET_ACCESS_KEY = credentials('aws-secret-key')
        REGION = 'us-east-1'
        MAX_RETRIES = "3"
        DELAY_RETRIES = "5"
        IMAGE_NAME = "my-ecr-repository"
        ACCOUNT_ID = "225387892229"
        TAG = "${BUILD_NUMBER}" 
        LAUNCH_TEMPLATE_NAME = "my-app-launch-template"
        ASG_NAME = "my-app-asg"
        PATH = "/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
    }

    options {
        buildDiscarder(logRotator(numToKeepStr: '10'))
        timestamps()
        timeout(time: 30 , units: "MINUTES")
    }
     parameters {
          booleanParam(name: "SKIP_TEST", defaultValue: false, description: "skipping test stage")
          booleanParam(name: "SKIP_BUILD", defaultValue: false, description: "skipping build stage")
     }

    stages{
        stage("checkout code"){
            steps{
                git branch: 'main' ,url: 'https://github.com/Nikhil00-7/first-app.git'
            }
        }

        stage("Pre check"){
            steps{
                script{

                    def files = ['Dockerfile' , 'package.json']
                      files.each {file -> 
                        if (!fileExists){
                        error("All file must required")
                        }
                      }
                      echo "All file is present"
                      }
                }
            }
        }

        stage("install dependency"){
            steps{
    
                sh "npm install"
            }
        }

        stage("Parallel stages") {
            when {
                expression { !params.SKIP_TEST && !params.SKIP_BUILD }
            }
            parallel {
                failFast true

                stage("code quality test / lint") {
                    steps {
                        sh "npm run lint"
                    }
                }

                stage("run test") {
                    steps {
                        sh "npm test"
                    }
                }

                stage("build") {
                    steps {
                        sh "npm run build"
                    }
                }
            }
        }

        stage("docker build"){
            steps{
                script{
                    retryWithDelay({
                        sh "docker build -t ${IMAGE_NAME}:${BUILD_NUMBER} ."
                    },env.MAX_RETRIES.toInteger(), env.DELAY_RETRIES.toInteger())
                }
            }
        }

        stage("Scan image for vulnerabilitie"){
            steps{
             retryWithDelay({
                sh """ 
                docker run --rm \
                  aquasec/trivy image \
                  --exit-code 0 \
                  --severity HIGH,CRITICAL \
                  --timeout 5m \
                  --format table \
                ${IMAGE_NAME}:${BUILD_NUMBER}
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
        stage("Push to ECR"){
            steps{
                retryWithDelay({
                    sh """
                    # Tag with build number and latest
                    docker tag ${IMAGE_NAME}:${BUILD_NUMBER} ${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${IMAGE_NAME}:${BUILD_NUMBER}
                    docker tag ${IMAGE_NAME}:${BUILD_NUMBER} ${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${IMAGE_NAME}:latest

                    # Push both tags
                    docker push ${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${IMAGE_NAME}:${BUILD_NUMBER}
                    docker push ${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${IMAGE_NAME}:latest
                    """
                },env.MAX_RETRIES.toInteger(), env.DELAY_RETRIES.toInteger())
            }
        }

       stage("Deploy to EC2") {
    steps {
        script {
            def region = env.REGION
            def asgName = env.ASG_NAME

            def currentCapacity = sh(script: """
                aws autoscaling describe-auto-scaling-groups \
                  --auto-scaling-group-names ${asgName} \
                  --query 'AutoScalingGroups[0].DesiredCapacity' \
                  --output text \
                  --region ${region}
            """, returnStdout: true).trim().toInteger()

            echo "Current ASG capacity: ${currentCapacity}"

            if (currentCapacity == 0) {
                echo "First deployment — scaling up ASG to 2..."
                sh """
                aws autoscaling set-desired-capacity \
                  --auto-scaling-group-name ${asgName} \
                  --desired-capacity 2 \
                  --region ${region}
                """
            } else {
                echo "Rolling update — starting instance refresh..."
                sh """
                aws autoscaling start-instance-refresh \
                  --auto-scaling-group-name ${asgName} \
                  --strategy Rolling \
                  --preferences '{"MinHealthyPercentage": 50, "InstanceWarmup": 120}' \
                  --region ${region}
                """


                timeout(time: 15, unit: 'MINUTES') {
                    waitUntil(initialRecurrencePeriod: 30000) {
                        def refreshStatus = sh(script: """
                            aws autoscaling describe-instance-refreshes \
                              --auto-scaling-group-name ${asgName} \
                              --region ${region} \
                              --query 'InstanceRefreshes[0].Status' \
                              --output text
                        """, returnStdout: true).trim()

                        echo "Instance refresh status: ${refreshStatus}"

                        if (refreshStatus == "Failed" || refreshStatus == "Cancelled") {
                            error("Instance refresh ${refreshStatus} — deployment aborted")
                        }

                        return refreshStatus == "Successful"
                    }
                }
            }
        }
    }
}
        stage("cleanup") {
            steps {
                sh """
                # Clean up dangling Docker images
                docker image prune -f
                """
            }
        }

        stage("verify deployment") {
            steps {
                script {
                    timeout(time: 15, unit: 'MINUTES') {
                        waitUntil {
                            def healthyCount = sh(script: """
                                aws autoscaling describe-auto-scaling-groups \
                                  --auto-scaling-group-names ${ASG_NAME} \
                                  --region ${REGION} \
                                  --query 'AutoScalingGroups[0].Instances[?HealthStatus==\`Healthy\`].InstanceId' \
                                  --output text | wc -w
                            """, returnStdout: true).trim().toInteger()

                            def desiredCapacity = sh(script: """
                                aws autoscaling describe-auto-scaling-groups \
                                  --auto-scaling-group-names ${ASG_NAME} \
                                  --region ${REGION} \
                                  --query 'AutoScalingGroups[0].DesiredCapacity' \
                                  --output text
                            """, returnStdout: true).trim().toInteger()

                            echo "Healthy instances: ${healthyCount}/${desiredCapacity}"
                            return healthyCount == desiredCapacity
                        }
                    }

                    echo "All instances are healthy! Deployment successful."
                }
            }
        }
    }

    post {
        success {
            echo "Pipeline completed successfully! Application deployed to EC2 Auto Scaling Group."
            emailext(
                 subject: "SUCCESS: ${env.JOB_NAME} #${env.BUILD_NUMBER}",
                body: """
                  project is deployed successfully 

                Job:      ${env.JOB_NAME}
                Build:    #${env.BUILD_NUMBER}
                URL:      ${env.BUILD_URL}         
                """,
                to: "kujurnikhil0007@gmail.com" 
            )
        }
        failure {
            echo "Pipeline failed! Check the logs for details."

               subject: "FAILURE: ${env.JOB_NAME} #${env.BUILD_NUMBER}",
                body: """
                Failed to deploy application 

                Job:   ${env.JOB_NAME}
                Build: #${env.BUILD_NUMBER}
                URL:   ${env.BUILD_URL}

                """,
                to: "kujurnikhil0007@gmail.com"
        }
    }
}