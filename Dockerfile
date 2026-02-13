# Start with the base image
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app

COPY . .

# Install ALL build dependencies including OpenSSL
RUN apt-get update && \
    apt-get install -y \
        g++ \
        make \
        cmake \
        libssl-dev \
        pkg-config \
        tree \
        && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Create build directories
RUN mkdir -p \
    main/src/main/java/com/app/main/root/app/_crypto/message_encoder/.build \
    main/src/main/java/com/app/main/root/app/_crypto/file_encoder/.build \
    main/src/main/java/com/app/main/root/app/_crypto/password_encoder/.build \
    main/src/main/java/com/app/main/root/app/_crypto/user_validator/.build \
    main/src/main/java/com/app/main/root/app/file_compressor/.build

# Create compilation helper script WITH PROPER INCLUDES
RUN echo '#!/bin/bash\n\
set -e\n\
\n\
# Find Java include directory\n\
JAVA_HOME=$(dirname $(dirname $(readlink -f $(which java))))\n\
JNI_INCLUDE="$JAVA_HOME/include"\n\
JNI_INCLUDE_LINUX="$JAVA_HOME/include/linux"\n\
\n\
compile_native() {\n\
    local base_dir=$1\n\
    local output=$2\n\
    local module_name=$(basename $base_dir)\n\
    \n\
    echo "=========================================="\n\
    echo "🔧 COMPILING: $module_name"\n\
    echo "=========================================="\n\
    \n\
    cd "$base_dir"\n\
    \n\
    # Find all CPP files, including those in subdirectories\n\
    CPP_FILES=$(find . -name "*.cpp" -type f | sort)\n\
    \n\
    if [ -z "$CPP_FILES" ]; then\n\
        echo "❌ ERROR: No .cpp files found!"\n\
        exit 1\n\
    fi\n\
    \n\
    echo "📂 Found CPP files:"\n\
    echo "$CPP_FILES" | sed "s/^/  - /"\n\
    echo ""\n\
    \n\
    # Clean and create build directory\n\
    rm -rf .build\n\
    mkdir -p .build\n\
    \n\
    # Compile each file\n\
    echo "🔨 Compiling..."\n\
    for cpp_file in $CPP_FILES; do\n\
        # Create object file path preserving directory structure\n\
        rel_path=${cpp_file#./}\n\
        obj_dir=".build/$(dirname $rel_path)"\n\
        obj_file=".build/${rel_path%.*}.o"\n\
        \n\
        mkdir -p "$obj_dir"\n\
        \n\
        echo "  Compiling: $rel_path"\n\
        \n\
        # Compile with include paths for all subdirectories\n\
        g++ -c -fPIC \\\n\
            "$cpp_file" \\\n\
            -o "$obj_file" \\\n\
            -I. \\\n\
            -I./keys \\\n\
            -I./crypto_operations \\\n\
            -I./aes_operations \\\n\
            -I./utils \\\n\
            -I"$JNI_INCLUDE" \\\n\
            -I"$JNI_INCLUDE_LINUX" \\\n\
            -I/usr/include/openssl \\\n\
            -std=c++17 \\\n\
            -O2 \\\n\
            -Wall \\\n\
            -Wno-unused-parameter\n\
        \n\
        echo "    ✅ Created ${rel_path%.*}.o"\n\
    done\n\
    \n\
    echo ""\n\
    echo "📦 Object files created:"\n\
    find .build -name "*.o" -type f | sed "s/^/  /"\n\
    \n\
    echo ""\n\
    echo "🔗 Linking shared library..."\n\
    \n\
    # Find all object files\n\
    OBJ_FILES=$(find .build -name "*.o" -type f)\n\
    \n\
    # Link all object files\n\
    g++ -shared -fPIC \\\n\
        $OBJ_FILES \\\n\
        -o "$output" \\\n\
        -L/usr/lib/x86_64-linux-gnu \\\n\
        -lcrypto \\\n\
        -lssl \\\n\
        -lpthread\n\
    \n\
    echo "✅ Library created: $(basename $output)"\n\
    \n\
    # Verify symbols for message_encoder\n\
    if [ "$module_name" = "message_encoder" ]; then\n\
        echo ""\n\
        echo "🔍 Verifying KeyDerivation symbols in message_encoder:"\n\
        if nm -C "$output" 2>/dev/null | grep -q "KeyDerivation::KDF_RK"; then\n\
            echo "✅ KeyDerivation::KDF_RK found"\n\
            nm -C "$output" 2>/dev/null | grep "KeyDerivation::" | sed "s/^/  /"\n\
        else\n\
            echo "❌ ERROR: KeyDerivation::KDF_RK not found!"\n\
            echo "Checking all symbols:"\n\
            nm -C "$output" 2>/dev/null | grep -i keyderivation || echo "  No KeyDerivation symbols at all"\n\
            exit 1\n\
        fi\n\
    fi\n\
    \n\
    echo "=========================================="\n\
    echo ""\n\
}\n\
\n\
# Compile each module\n\
compile_native "/app/main/src/main/java/com/app/main/root/app/_crypto/message_encoder" "/usr/local/lib/libmessage_encoder.so"\n\
compile_native "/app/main/src/main/java/com/app/main/root/app/_crypto/file_encoder" "/usr/local/lib/libfileencoder.so"\n\
compile_native "/app/main/src/main/java/com/app/main/root/app/_crypto/password_encoder" "/usr/local/lib/libpasswordencoder.so"\n\
compile_native "/app/main/src/main/java/com/app/main/root/app/_crypto/user_validator" "/usr/local/lib/libuser_validator.so"\n\
compile_native "/app/main/src/main/java/com/app/main/root/app/file_compressor" "/usr/local/lib/libfile_compressor.so"\n\
' > /usr/local/bin/compile_native.sh && chmod +x /usr/local/bin/compile_native.sh

# Run the compilation
RUN /usr/local/bin/compile_native.sh

# Build Spring Boot application
RUN cd main && mvn clean package -DskipTests && \
    echo "✅ SPRING BOOT BUILD COMPLETED"

# Final runtime stage
FROM eclipse-temurin:21-jre
WORKDIR /app

# Install runtime dependencies
RUN apt-get update && \
    apt-get install -y \
        curl \
        nodejs \
        libssl3 \
        libstdc++6 \
        && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Create directories
RUN mkdir -p \
    /app/lib/native/linux \
    /app/src/main/java/com/app/main/root/public \
    /app/src/main/java/com/app/main/root/app/_crypto/message_encoder/keys && \
    chmod -R 777 /app/src/main/java/com/app/main/root/app/_crypto/message_encoder/keys

# Copy native libraries to BOTH locations
COPY --from=build /usr/local/lib/libmessage_encoder.so /usr/local/lib/
COPY --from=build /usr/local/lib/libfileencoder.so /usr/local/lib/
COPY --from=build /usr/local/lib/libpasswordencoder.so /usr/local/lib/
COPY --from=build /usr/local/lib/libuser_validator.so /usr/local/lib/
COPY --from=build /usr/local/lib/libfile_compressor.so /usr/local/lib/

COPY --from=build /usr/local/lib/libmessage_encoder.so /app/lib/native/linux/
COPY --from=build /usr/local/lib/libfileencoder.so /app/lib/native/linux/
COPY --from=build /usr/local/lib/libpasswordencoder.so /app/lib/native/linux/
COPY --from=build /usr/local/lib/libuser_validator.so /app/lib/native/linux/
COPY --from=build /usr/local/lib/libfile_compressor.so /app/lib/native/linux/

# Copy SQL files and config scripts
COPY --from=build /app/main/src/main/java/com/app/main/root/app/_db/src/*.sql /app/src/main/java/com/app/main/root/app/_db/src/
COPY --from=build /app/main/src/main/java/com/app/main/root/public/generate-config.js /app/src/main/java/com/app/main/root/public/
COPY --from=build /app/main/src/main/java/com/app/main/root/public/encrypt-url.js /app/src/main/java/com/app/main/root/public/

# Copy the jar file
COPY --from=build /app/main/target/main-0.0.1-SNAPSHOT.jar server.jar

# Set library paths
ENV LD_LIBRARY_PATH=/usr/local/lib:/app/lib/native/linux:$LD_LIBRARY_PATH
ENV JAVA_LIBRARY_PATH=/usr/local/lib:/app/lib/native/linux

EXPOSE 3001

# Run config generation then start server
CMD ["/bin/sh", "-c", "\
    echo '=== Starting Application ===' && \
    echo 'Environment: $APP_ENV' && \
    if [ \"$APP_ENV\" = \"prod\" ] || [ \"$APP_ENV\" = \"production\" ]; then \
        echo 'Generating production config...' && \
        cd /app && \
        node src/main/java/com/app/main/root/public/generate-config.js && \
        echo 'Config generated successfully'; \
    fi && \
    echo 'Starting Spring Boot server...' && \
    exec java -Djava.library.path=/usr/local/lib:/app/lib/native/linux -jar /app/server.jar \
"]