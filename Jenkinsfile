pipeline {
    // Agent is set to a node with the 'windows' label
    agent { label 'windows' }

    // Central environment block to define variables used across stages
    environment {
        DOCKERHUB_USER  = 'sumatisinha'
        IMAGE_NAME      = 'to-do-app'
        // Jenkins credentials ID for Docker Hub
        DOCKER_CREDS_ID = 'dockerhub-creds'
    }

    stages {
        stage('Checkout Source Code') {
            steps {
                echo "Running on Windows node: ${env.NODE_NAME}"
                // Clean the workspace before checking out new code
                cleanWs()
                git url: 'https://github.com/sumatisinha/ToDo-App-sumati.git', branch: 'main'
            }
        }

        stage('Build Docker Image') {
            steps {
                script {
                    // Define a variable for the full image name with the build number tag
                    def fullImageName = "${IMAGE_NAME}:${env.BUILD_NUMBER}"
                    echo "Building Docker image: ${fullImageName}"
                    bat "docker context use default"
                    // Use the docker.build() command from the Docker Pipeline plugin
                    // This is a more integrated way to build images in Jenkins
                    docker.build(fullImageName, '.')
                }
            }
        }

        stage('Push Docker Image') {
            steps {
                script {
                    // Log in to Docker Hub using the specified credentials
                    docker.withRegistry("https://index.docker.io/v1/", DOCKER_CREDS_ID) {
                        
                        def buildImageName = "${IMAGE_NAME}:${env.BUILD_NUMBER}"
                        def registryImageName = "${DOCKERHUB_USER}/${IMAGE_NAME}:${env.BUILD_NUMBER}"
                        def latestImageName = "${DOCKERHUB_USER}/${IMAGE_NAME}:latest"
                        
                        bat "docker context use default"
                        echo "Tagging image ${buildImageName} as ${registryImageName}"
                        bat "docker tag ${buildImageName} ${registryImageName}"

                        echo "Tagging image ${buildImageName} as ${latestImageName}"
                        bat "docker tag ${buildImageName} ${latestImageName}"
                        
                        echo "Pushing image: ${registryImageName}"
                        bat "docker push ${registryImageName}"

                        echo "Pushing latest image: ${latestImageName}"
                        bat "docker push ${latestImageName}"
                    }
                }
            }
        }

        stage('Deploy with Kubernetes') {
            steps {
                script {
                    // It's crucial that your deployment YAML uses the image we just pushed.
                    // This command replaces a placeholder in the YAML with the actual image name.
                    // Your notes-app-deployment.yaml should have an image name like: akash210994/to-do-app:latest
                    bat "dir"
                    echo "Applying Kubernetes manifests..."
                    bat "kubectl apply -f postgres-deployment.yml"
                    sleep(10) 
                    bat "kubectl apply -f to-do-app-deployment.yml"
                    sleep(10) 

                    echo "Verifying deployment..."
                    bat "kubectl get pods"
                    bat "kubectl get service"
                }
            }
        }
    }
    
    post {
        always {
            echo 'Pipeline finished.'
        }
    }
}
