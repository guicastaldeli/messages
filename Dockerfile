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

# Create enhanced compilation helper script
RUN echo '#!/bin/bash\n\
set -e\n\
compile_native() {\n\
    local base_dir=$1\n\
    local output=$2\n\
    \n\
    echo "=========================================="\n\
    echo "Compiling library: $(basename $output)"\n\
    echo "Base directory: $base_dir"\n\
    echo "=========================================="\n\
    \n\
    cd "$base_dir"\n\
    \n\
    # Find all C++ source files recursively (not in .build directories)\n\
    echo "Searching for source files..."\n\
    CPP_FILES=$(find . -type f \( -name "*.cpp" -o -name "*.cc" -o -name "*.cxx" \) -not -path "*/.build/*" -not -path "*/.*" | sort)\n\
    \n\
    if [ -z "$CPP_FILES" ]; then\n\
        echo "❌ ERROR: No C++ source files found in $base_dir"\n\
        echo "Directory structure:"\n\
        find . -type f -name "*.cpp" -o -name "*.h" | head -20\n\
        exit 1\n\
    fi\n\
    \n\
    echo "Found $(echo "$CPP_FILES" | wc -l) source file(s):"\n\
    echo "$CPP_FILES" | sed "s|^|  - |"\n\
    echo ""\n\
    \n\
    # Find all subdirectories for includes (excluding .build and hidden dirs)\n\
    INCLUDE_DIRS=$(find . -type d -not -path "*/.build*" -not -path "*/.*" | sed "s|^|-I|" | tr "\\n" " ")\n\
    \n\
    # Create .build directory if it does not exist\n\
    mkdir -p .build\n\
    \n\
    # Compile each source file to object file\n\
    echo "Compiling source files..."\n\
    OBJ_FILES=""\n\
    for cpp_file in $CPP_FILES; do\n\
        # Get base filename without path and extension\n\
        base_name=$(basename "$cpp_file")\n\
        obj_name="${base_name%.*}.o"\n\
        obj_file=".build/$obj_name"\n\
        \n\
        echo "  [$((++count))] Compiling: $cpp_file -> $obj_name"\n\
        \n\
        # Compile with all necessary flags\n\
        g++ -c -fPIC \\\n\
            "$cpp_file" \\\n\
            -o "$obj_file" \\\n\
            $INCLUDE_DIRS \\\n\
            -I/usr/include/openssl \\\n\
            -I/usr/include \\\n\
            -I. \\\n\
            -std=c++17 \\\n\
            -O2 \\\n\
            -Wall \\\n\
            -Wno-unused-parameter \\\n\
            -DNDEBUG 2>&1 | head -10\n\
        \n\
        if [ ${PIPESTATUS[0]} -ne 0 ]; then\n\
            echo "❌ ERROR: Failed to compile $cpp_file"\n\
            exit 1\n\
        fi\n\
        \n\
        OBJ_FILES="$OBJ_FILES $obj_file"\n\
    done\n\
    \n\
    echo ""\n\
    echo "Linking shared library..."\n\
    echo "Output: $output"\n\
    echo "Object files: $(echo $OBJ_FILES | wc -w) files"\n\
    \n\
    # Link all object files into shared library\n\
    g++ -shared -fPIC \\\n\
        $OBJ_FILES \\\n\
        -o "$output" \\\n\
        -lcrypto \\\n\
        -lssl \\\n\
        -lpthread \\\n\
        -Wl,--no-undefined 2>&1\n\
    \n\
    LINK_RESULT=$?\n\
    \n\
    if [ $LINK_RESULT -ne 0 ]; then\n\
        echo "❌ ERROR: Failed to link shared library"\n\
        echo "Checking for missing symbols..."\n\
        g++ -shared -fPIC $OBJ_FILES -o "$output" -lcrypto -lssl -lpthread 2>&1 | grep "undefined reference" | head -20\n\
        exit 1\n\
    fi\n\
    \n\
    echo ""\n\
    echo "✅ Successfully built: $(basename $output)"\n\
    echo "  Size: $(du -h $output | cut -f1)"\n\
    echo ""\n\
    \n\
    # Verify the library\n\
    echo "Verifying shared library..."\n\
    if ! ldd "$output" > /dev/null 2>&1; then\n\
        echo "⚠️  Warning: ldd check failed, but library may still work"\n\
    else\n\
        echo "  ✓ Library dependencies OK"\n\
    fi\n\
    \n\
    # Check for undefined symbols (should only be system libraries)\n\
    UNDEFINED=$(nm -D "$output" 2>/dev/null | grep " U " | grep -v "@@" | head -10 || true)\n\
    if [ -n "$UNDEFINED" ]; then\n\
        echo ""\n\
        echo "⚠️  Found undefined symbols (checking if problematic):"\n\
        echo "$UNDEFINED" | sed "s/^/    /"\n\
        # Check specifically for KeyDerivation symbols\n\
        if echo "$UNDEFINED" | grep -i "KeyDerivation" > /dev/null; then\n\
            echo ""\n\
            echo "❌ CRITICAL: Found undefined KeyDerivation symbols!"\n\
            exit 1\n\
        fi\n\
    fi\n\
    \n\
    echo "=========================================="\n\
    echo ""\n\
}\n\
' > /usr/local/bin/compile_native.sh && chmod +x /usr/local/bin/compile_native.sh

# Compile message_encoder
RUN echo "===== Compiling message_encoder =====" && \
    /usr/local/bin/compile_native.sh \
    main/src/main/java/com/app/main/root/app/_crypto/message_encoder \
    main/src/main/java/com/app/main/root/app/_crypto/message_encoder/.build/libmessage_encoder.so

# Compile file_encoder
RUN echo "===== Compiling file_encoder =====" && \
    /usr/local/bin/compile_native.sh \
    main/src/main/java/com/app/main/root/app/_crypto/file_encoder \
    main/src/main/java/com/app/main/root/app/_crypto/file_encoder/.build/libfileencoder.so

# Compile password_encoder
RUN echo "===== Compiling password_encoder =====" && \
    /usr/local/bin/compile_native.sh \
    main/src/main/java/com/app/main/root/app/_crypto/password_encoder \
    main/src/main/java/com/app/main/root/app/_crypto/password_encoder/.build/libpasswordencoder.so

# Compile user_validator
RUN echo "===== Compiling user_validator =====" && \
    /usr/local/bin/compile_native.sh \
    main/src/main/java/com/app/main/root/app/_crypto/user_validator \
    main/src/main/java/com/app/main/root/app/_crypto/user_validator/.build/libuser_validator.so

# Compile file_compressor
RUN echo "===== Compiling file_compressor =====" && \
    /usr/local/bin/compile_native.sh \
    main/src/main/java/com/app/main/root/app/file_compressor \
    main/src/main/java/com/app/main/root/app/file_compressor/.build/libfile_compressor.so

# Build the Spring Boot application
RUN cd main && mvn clean package -DskipTests

# Final stage
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
RUN mkdir -p /app/lib/native/linux /app/src/main/java/com/app/main/root/public

# Copy the freshly built native libraries to both locations
COPY --from=build /app/main/src/main/java/com/app/main/root/app/_crypto/message_encoder/.build/libmessage_encoder.so /usr/local/lib/
COPY --from=build /app/main/src/main/java/com/app/main/root/app/_crypto/file_encoder/.build/libfileencoder.so /usr/local/lib/
COPY --from=build /app/main/src/main/java/com/app/main/root/app/_crypto/password_encoder/.build/libpasswordencoder.so /usr/local/lib/
COPY --from=build /app/main/src/main/java/com/app/main/root/app/_crypto/user_validator/.build/libuser_validator.so /usr/local/lib/
COPY --from=build /app/main/src/main/java/com/app/main/root/app/file_compressor/.build/libfile_compressor.so /usr/local/lib/

COPY --from=build /app/main/src/main/java/com/app/main/root/app/_crypto/message_encoder/.build/libmessage_encoder.so /app/lib/native/linux/
COPY --from=build /app/main/src/main/java/com/app/main/root/app/_crypto/file_encoder/.build/libfileencoder.so /app/lib/native/linux/
COPY --from=build /app/main/src/main/java/com/app/main/root/app/_crypto/password_encoder/.build/libpasswordencoder.so /app/lib/native/linux/
COPY --from=build /app/main/src/main/java/com/app/main/root/app/_crypto/user_validator/.build/libuser_validator.so /app/lib/native/linux/
COPY --from=build /app/main/src/main/java/com/app/main/root/app/file_compressor/.build/libfile_compressor.so /app/lib/native/linux/

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