FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app

# Copy all source code
COPY . .

# Build the application
RUN cd main && mvn clean package -DskipTests

# Use a lighter runtime image
FROM eclipse-temurin:21-jre
WORKDIR /app

# Copy the built jar from build stage
COPY --from=build /app/main/target/main-0.0.1.jar server.jar

EXPOSE 3001
CMD ["java", "-jar", "server.jar"]