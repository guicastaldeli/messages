FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app

COPY . .

# Install build dependencies
RUN apt-get update && \
    apt-get install -y g++ gcc libssl-dev pkg-config && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Find and copy key_derivation files to all C++ modules
RUN echo "Finding key_derivation files..." && \
    KEY_CPP=$(find /app -name "key_derivation.cpp" -type f | head -1) && \
    KEY_H=$(find /app -name "key_derivation.h" -type f | head -1) && \
    echo "Found key_derivation.cpp at: $KEY_CPP" && \
    cp -v "$KEY_CPP" /app/main/src/main/java/com/app/main/root/app/_crypto/message_encoder/ && \
    cp -v "$KEY_CPP" /app/main/src/main/java/com/app/main/root/app/_crypto/password_encoder/ && \
    if [ -n "$KEY_H" ]; then \
        echo "Found key_derivation.h at: $KEY_H"; \
        cp -v "$KEY_H" /app/main/src/main/java/com/app/main/root/app/_crypto/message_encoder/; \
        cp -v "$KEY_H" /app/main/src/main/java/com/app/main/root/app/_crypto/password_encoder/; \
    fi

# Compile message_encoder (C++ with key_derivation)
RUN cd /app/main/src/main/java/com/app/main/root/app/_crypto/message_encoder && \
    echo "=== COMPILING MESSAGE_ENCODER ===" && \
    mkdir -p .build && \
    echo "Source files:" && \
    ls -la *.cpp *.h 2>/dev/null || true && \
    for cpp in *.cpp; do \
        [ -f "$cpp" ] || continue; \
        echo "Compiling $cpp"; \
        g++ -c -fPIC "$cpp" -o ".build/${cpp%.cpp}.o" \
            -I. \
            -I/usr/include/openssl \
            -I/usr/lib/jvm/java-21-openjdk-amd64/include \
            -I/usr/lib/jvm/java-21-openjdk-amd64/include/linux \
            -std=c++17 -O2 -Wall -Wno-unused-parameter -Wno-deprecated-declarations; \
    done && \
    echo "Object files:" && \
    ls -lh .build/*.o && \
    g++ -shared -fPIC .build/*.o -o .build/libmessage_encoder.so -lcrypto -lssl -lpthread && \
    echo "Library created:" && \
    ls -lh .build/libmessage_encoder.so && \
    echo "KeyDerivation symbols:" && \
    nm -D .build/libmessage_encoder.so | grep KeyDerivation || echo "WARNING: No KeyDerivation symbols"

# Compile file_encoder (C files, NOT C++)
RUN cd /app/main/src/main/java/com/app/main/root/app/_crypto/file_encoder && \
    echo "=== COMPILING FILE_ENCODER ===" && \
    mkdir -p .build && \
    echo "Source files:" && \
    ls -la *.c *.h 2>/dev/null || true && \
    for c in *.c; do \
        [ -f "$c" ] || continue; \
        echo "Compiling $c"; \
        gcc -c -fPIC "$c" -o ".build/${c%.c}.o" \
            -I. \
            -I/usr/include/openssl \
            -I/usr/lib/jvm/java-21-openjdk-amd64/include \
            -I/usr/lib/jvm/java-21-openjdk-amd64/include/linux \
            -O2 -Wall -Wno-unused-parameter; \
    done && \
    echo "Object files:" && \
    ls -lh .build/*.o && \
    gcc -shared -fPIC .build/*.o -o .build/libfileencoder.so -lcrypto -lssl -lpthread && \
    ls -lh .build/libfileencoder.so

# Compile password_encoder (C++ with key_derivation)
RUN cd /app/main/src/main/java/com/app/main/root/app/_crypto/password_encoder && \
    echo "=== COMPILING PASSWORD_ENCODER ===" && \
    mkdir -p .build && \
    echo "Source files:" && \
    ls -la *.cpp *.h 2>/dev/null || true && \
    for cpp in *.cpp; do \
        [ -f "$cpp" ] || continue; \
        echo "Compiling $cpp"; \
        g++ -c -fPIC "$cpp" -o ".build/${cpp%.cpp}.o" \
            -I. \
            -I/usr/include/openssl \
            -I/usr/lib/jvm/java-21-openjdk-amd64/include \
            -I/usr/lib/jvm/java-21-openjdk-amd64/include/linux \
            -std=c++17 -O2 -Wall -Wno-unused-parameter -Wno-deprecated-declarations; \
    done && \
    echo "Object files:" && \
    ls -lh .build/*.o && \
    g++ -shared -fPIC .build/*.o -o .build/libpasswordencoder.so -lcrypto -lssl -lpthread && \
    echo "Library created:" && \
    ls -lh .build/libpasswordencoder.so && \
    echo "KeyDerivation symbols:" && \
    nm -D .build/libpasswordencoder.so | grep KeyDerivation || echo "WARNING: No KeyDerivation symbols"

# Compile user_validator (C++)
RUN cd /app/main/src/main/java/com/app/main/root/app/_crypto/user_validator && \
    echo "=== COMPILING USER_VALIDATOR ===" && \
    mkdir -p .build && \
    echo "Source files:" && \
    ls -la *.cpp *.h 2>/dev/null || true && \
    for cpp in *.cpp; do \
        [ -f "$cpp" ] || continue; \
        echo "Compiling $cpp"; \
        g++ -c -fPIC "$cpp" -o ".build/${cpp%.cpp}.o" \
            -I. \
            -I/usr/include/openssl \
            -I/usr/lib/jvm/java-21-openjdk-amd64/include \
            -I/usr/lib/jvm/java-21-openjdk-amd64/include/linux \
            -std=c++17 -O2 -Wall -Wno-unused-parameter -Wno-deprecated-declarations; \
    done && \
    echo "Object files:" && \
    ls -lh .build/*.o && \
    g++ -shared -fPIC .build/*.o -o .build/libuser_validator.so -lcrypto -lssl -lpthread && \
    ls -lh .build/libuser_validator.so

# Compile file_compressor (C files)
RUN cd /app/main/src/main/java/com/app/main/root/app/file_compressor && \
    echo "=== COMPILING FILE_COMPRESSOR ===" && \
    mkdir -p .build && \
    echo "Source files:" && \
    ls -la *.c *.h 2>/dev/null || true && \
    for c in *.c; do \
        [ -f "$c" ] || continue; \
        echo "Compiling $c"; \
        gcc -c -fPIC "$c" -o ".build/${c%.c}.o" \
            -I. \
            -I/usr/include/openssl \
            -I/usr/lib/jvm/java-21-openjdk-amd64/include \
            -I/usr/lib/jvm/java-21-openjdk-amd64/include/linux \
            -O2 -Wall -Wno-unused-parameter; \
    done && \
    echo "Object files:" && \
    ls -lh .build/*.o && \
    gcc -shared -fPIC .build/*.o -o .build/libfile_compressor.so -lcrypto -lssl -lpthread && \
    ls -lh .build/libfile_compressor.so

# Verify KeyDerivation symbols in libraries that need them
RUN echo "" && \
    echo "=== FINAL SYMBOL VERIFICATION ===" && \
    for lib in \
        /app/main/src/main/java/com/app/main/root/app/_crypto/message_encoder/.build/libmessage_encoder.so \
        /app/main/src/main/java/com/app/main/root/app/_crypto/password_encoder/.build/libpasswordencoder.so; do \
        echo ""; \
        echo "Checking $(basename $lib):"; \
        if nm -D "$lib" | grep -i "KeyDerivation" | grep " T "; then \
            echo "✅ KeyDerivation symbols found"; \
        else \
            echo "❌ CRITICAL: No KeyDerivation symbols!"; \
            echo "All symbols:"; \
            nm -D "$lib" | grep " T " | head -20; \
            exit 1; \
        fi; \
    done && \
    echo "✅ All verifications passed"

# Build Spring Boot
RUN cd main && mvn clean package -DskipTests

# Runtime stage
FROM eclipse-temurin:21-jre
WORKDIR /app

RUN apt-get update && \
    apt-get install -y curl nodejs libssl3 libstdc++6 && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

RUN mkdir -p \
    /app/lib/native/linux \
    /app/src/main/java/com/app/main/root/public \
    /app/src/main/java/com/app/main/root/app/_crypto/message_encoder/keys && \
    chmod -R 777 /app/src/main/java/com/app/main/root/app/_crypto/message_encoder/keys

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

COPY --from=build /app/main/src/main/java/com/app/main/root/app/_db/src/*.sql /app/src/main/java/com/app/main/root/app/_db/src/
COPY --from=build /app/main/src/main/java/com/app/main/root/public/generate-config.js /app/src/main/java/com/app/main/root/public/
COPY --from=build /app/main/src/main/java/com/app/main/root/public/encrypt-url.js /app/src/main/java/com/app/main/root/public/
COPY --from=build /app/main/target/main-0.0.1-SNAPSHOT.jar server.jar

ENV LD_LIBRARY_PATH=/usr/local/lib:/app/lib/native/linux:$LD_LIBRARY_PATH
ENV JAVA_LIBRARY_PATH=/usr/local/lib:/app/lib/native/linux

EXPOSE 3001

CMD ["/bin/sh", "-c", "\
    echo '=== Starting Application ===' && \
    if [ \"$APP_ENV\" = \"prod\" ] || [ \"$APP_ENV\" = \"production\" ]; then \
        cd /app && node src/main/java/com/app/main/root/public/generate-config.js; \
    fi && \
    exec java -Djava.library.path=/usr/local/lib:/app/lib/native/linux -jar /app/server.jar \
"]