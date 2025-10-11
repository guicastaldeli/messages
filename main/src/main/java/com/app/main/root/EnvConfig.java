package com.app.main.root;
import com.app.main.root.app._utils.ColorConverter;
import io.github.cdimascio.dotenv.Dotenv;

public class EnvConfig {
    private static final Dotenv dotenv;
    private static boolean init = false;

    static {
        if(!init) {
            String env = System.getProperty("app.env", "dev");
            String fileName = ".env." + env;
    
            dotenv = Dotenv.configure()
            .directory("src/main/java/com/app/main/root/app/___env-config")
            .filename(fileName)
            .ignoreIfMissing()
            .load();
    
            ColorConverter colorConverter = new ColorConverter();
            String content = "Loaded env: " + env + " from file: " + fileName;
            String message = colorConverter.style(content, "yellow", "italic");  
            System.out.println(message);

            init = true;
        } else {
            dotenv = Dotenv.configure().load();
        }
    }
	
    public static String get(String key) {
        return dotenv.get(key);
    }
}
