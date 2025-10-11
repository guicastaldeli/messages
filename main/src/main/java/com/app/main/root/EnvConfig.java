package com.app.main.root;
import io.github.cdimascio.dotenv.Dotenv;

public class EnvConfig {
    private static final Dotenv dotenv = Dotenv.configure()
	.directory("src/main/java/com/app/main/root/app/___env-config")
	.filename(".env.dev")
	.load();
	
    public static String get(String key) {
        return dotenv.get(key);
    }
}
