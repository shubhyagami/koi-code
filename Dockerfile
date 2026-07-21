# ==========================================
# Build Stage
# ==========================================
FROM eclipse-temurin:17-jdk AS build
WORKDIR /app

# Copy Maven wrapper and POM first to cache dependencies
COPY mvnw .
COPY .mvn .mvn
COPY pom.xml .

# Fix line endings and permissions for mvnw (in case of Windows checkout)
RUN sed -i 's/\r$//' mvnw
RUN chmod +x mvnw

# Download dependencies (this step will be cached)
RUN ./mvnw dependency:go-offline

# Copy the rest of the source code
COPY src src

# Build the application
RUN ./mvnw clean package -DskipTests

# ==========================================
# Run Stage
# ==========================================
# Note: We MUST use a JDK image (not just JRE) for the run stage because 
# this Java IDE application needs `javac` at runtime to compile user code!
FROM eclipse-temurin:17-jdk
WORKDIR /app

# Copy the built jar from the build stage
COPY --from=build /app/target/*.jar app.jar

# Spring Boot defaults to 8080. If your app properties set 8082, 
# Render will automatically map the port you expose, but 
# it's best to allow the PORT environment variable to override it.
ENV SERVER_PORT=10000
EXPOSE 10000

# Run the jar
ENTRYPOINT ["java", "-jar", "app.jar"]
