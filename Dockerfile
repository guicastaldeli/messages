FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app

COPY . .

RUN cd main && mvn clean package -DskipTests

FROM eclipse-temurin:21-jre
WORKDIR /app

COPY --from=build /app/main/target/main-0.0.1-SNAPSHOT.jar server.jar

EXPOSE 3001
CMD ["java", "-jar", "server.jar"]