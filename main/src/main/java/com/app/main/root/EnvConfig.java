package com.app.main.root;
import com.app.main.root.app.utils.ColorConverter;
import io.github.cdimascio.dotenv.Dotenv;

public class EnvConfig {
    private static final Dotenv dotenv;
    private static boolean init = false;

    static {
        if(!init) {
            String env = System.getenv("APP_ENV");
            if(env == null) env = System.getProperty("app.env", "dev");
            String fileName = ".env." + env;

            String configDir = System.getenv("ENV_CONFIG_DIR");
            if(configDir == null || configDir.isEmpty()) configDir = "src/main/java/com/app/main/root/.env-config";
    
            dotenv = Dotenv.configure().directory(configDir)
                .filename(fileName)
                .ignoreIfMissing()
                .load();
    
            ColorConverter colorConverter = new ColorConverter();
            String content = "Loaded env: " + env + " from file: " + fileName;
            String message = colorConverter.style(content, "yellow", "italic");  
            System.out.println(message);

            String instances = dotenv.get("SERVER_INSTANCES");
            System.out.println("DEBUG: SERVER_INSTANCES after load: '" + instances + "'");

            init = true;
        } else {
            dotenv = Dotenv.configure().load();
        }
    }
	
    public static String get(String key) {
        return dotenv.get(key);
    }
}
