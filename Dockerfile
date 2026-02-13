FROM eclipse-temurin:21-jdk
WORKDIR /app

# Copy all source code
COPY . .

# Build the application
RUN cd main && mvn clean package -DskipTests

# Copy the built jar to app directory
RUN cp main/target/main-0.0.1.jar server.jar

EXPOSE 3001
CMD ["java", "-jar", "server.jar"]