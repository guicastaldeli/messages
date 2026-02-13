FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app

COPY . .

# Install build dependencies
RUN apt-get update && \
    apt-get install -y g++ libssl-dev pkg-config && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Find and copy key_derivation files to all modules
RUN echo "Finding key_derivation files..." && \
    KEY_CPP=$(find /app -name "key_derivation.cpp" -type f | head -1) && \
    KEY_H=$(find /app -name "key_derivation.h" -type f | head -1) && \
    echo "Found at: $KEY_CPP" && \
    cp -v "$KEY_CPP" /app/main/src/main/java/com/app/main/root/app/_crypto/message_encoder/ && \
    cp -v "$KEY_CPP" /app/main/src/main/java/com/app/main/root/app/_crypto/password_encoder/ && \
    cp -v "$KEY_CPP" /app/main/src/main/java/com/app/main/root/app/_crypto/user_validator/ && \
    cp -v "$KEY_CPP" /app/main/src/main/java/com/app/main/root/app/_crypto/file_encoder/ && \
    if [ -n "$KEY_H" ]; then \
        cp -v "$KEY_H" /app/main/src/main/java/com/app/main/root/app/_crypto/message_encoder/; \
        cp -v "$KEY_H" /app/main/src/main/java/com/app/main/root/app/_crypto/password_encoder/; \
        cp -v "$KEY_H" /app/main/src/main/java/com/app/main/root/app/_crypto/user_validator/; \
        cp -v "$KEY_H" /app/main/src/main/java/com/app/main/root/app/_crypto/file_encoder/; \
    fi

# Compile message_encoder
RUN cd /app/main/src/main/java/com/app/main/root/app/_crypto/message_encoder && \
    echo "=== COMPILING MESSAGE_ENCODER ===" && \
    mkdir -p .build && \
    ls -la *.cpp && \
    for cpp in *.cpp; do \
        echo "Compiling $cpp"; \
        g++ -c -fPIC "$cpp" -o ".build/${cpp%.cpp}.o" \
            -I. -I/usr/include/openssl -std=c++17 -O2 -Wall -Wno-unused-parameter; \
    done && \
    ls -lh .build/*.o && \
    g++ -shared -fPIC .build/*.o -o .build/libmessage_encoder.so -lcrypto -lssl -lpthread && \
    ls -lh .build/libmessage_encoder.so && \
    echo "Checking symbols:" && \
    nm -D .build/libmessage_encoder.so | grep KeyDerivation | head -10 || echo "NO KEYDERIVATION"

# Compile file_encoder  
RUN cd /app/main/src/main/java/com/app/main/root/app/_crypto/file_encoder && \
    echo "=== COMPILING FILE_ENCODER ===" && \
    mkdir -p .build && \
    for cpp in *.cpp *.c 2>/dev/null; do \
        [ -f "$cpp" ] || continue; \
        gcc -c -fPIC "$cpp" -o ".build/${cpp%.*}.o" \
            -I. -I/usr/include/openssl -O2 -Wall -Wno-unused-parameter; \
    done && \
    gcc -shared -fPIC .build/*.o -o .build/libfileencoder.so -lcrypto -lssl -lpthread

# Compile password_encoder
RUN cd /app/main/src/main/java/com/app/main/root/app/_crypto/password_encoder && \
    echo "=== COMPILING PASSWORD_ENCODER ===" && \
    mkdir -p .build && \
    for cpp in *.cpp; do \
        g++ -c -fPIC "$cpp" -o ".build/${cpp%.cpp}.o" \
            -I. -I/usr/include/openssl -std=c++17 -O2 -Wall -Wno-unused-parameter; \
    done && \
    g++ -shared -fPIC .build/*.o -o .build/libpasswordencoder.so -lcrypto -lssl -lpthread && \
    nm -D .build/libpasswordencoder.so | grep KeyDerivation || echo "NO KEYDERIVATION"

# Compile user_validator
RUN cd /app/main/src/main/java/com/app/main/root/app/_crypto/user_validator && \
    echo "=== COMPILING USER_VALIDATOR ===" && \
    mkdir -p .build && \
    for cpp in *.cpp; do \
        g++ -c -fPIC "$cpp" -o ".build/${cpp%.cpp}.o" \
            -I. -I/usr/include/openssl -std=c++17 -O2 -Wall -Wno-unused-parameter; \
    done && \
    g++ -shared -fPIC .build/*.o -o .build/libuser_validator.so -lcrypto -lssl -lpthread

# Compile file_compressor
RUN cd /app/main/src/main/java/com/app/main/root/app/file_compressor && \
    echo "=== COMPILING FILE_COMPRESSOR ===" && \
    mkdir -p .build && \
    for c in *.c 2>/dev/null; do \
        [ -f "$c" ] || continue; \
        gcc -c -fPIC "$c" -o ".build/${c%.c}.o" \
            -I. -I/usr/include/openssl -O2 -Wall -Wno-unused-parameter; \
    done && \
    gcc -shared -fPIC .build/*.o -o .build/libfile_compressor.so -lcrypto -lssl -lpthread

# Verify KeyDerivation symbols
RUN echo "=== SYMBOL VERIFICATION ===" && \
    for lib in \
        /app/main/src/main/java/com/app/main/root/app/_crypto/message_encoder/.build/libmessage_encoder.so \
        /app/main/src/main/java/com/app/main/root/app/_crypto/password_encoder/.build/libpasswordencoder.so; do \
        echo "Checking $(basename $lib):"; \
        if nm -D "$lib" | grep -i "KeyDerivation" | grep " T "; then \
            echo "✅ KeyDerivation found"; \
        else \
            echo "❌ NO KeyDerivation symbols!"; \
            exit 1; \
        fi; \
    done

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
    echo '=== Application Starting ===' && \
    if [ \"$APP_ENV\" = \"prod\" ] || [ \"$APP_ENV\" = \"production\" ]; then \
        cd /app && node src/main/java/com/app/main/root/public/generate-config.js; \
    fi && \
    exec java -Djava.library.path=/usr/local/lib:/app/lib/native/linux -jar /app/server.jar \
"]