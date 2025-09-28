package com.app.main.root;
import com.app.main.root.app._db.DbService;
import com.app.main.root.app._server.Server;
import com.app.main.root.app._utils.ColorConverter;
import com.app.main.root.app._config.Loading;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.context.annotation.Bean;

/*
***********************
*	-------------------
*
*		ENTRY POINT
*				
*	-------------------
***********************
*/

@SpringBootApplication()
public class MainApplication {
	private static final String PORT = 
	System.getenv("PORT") != null ?
	System.getenv("PORT") : "3001";

	public static void main(String[] args) {
		ConfigurableApplicationContext context = SpringApplication.run(MainApplication.class, args);
		Loading.finished();
		alert();
		init(context);
	}

	private static void init(ConfigurableApplicationContext context) {
		DbService dbService = context.getBean(DbService.class);
		dbService.alert();
		String baseUrl = buildBaseUrl();
		Server server = Server.getInstance(baseUrl, dbService);
		server.init(PORT);
		server.alert();
	}

	private static String buildBaseUrl() {
		return "http://localhost:" + PORT;
	}

	private static void alert() {
        ColorConverter colorConverter = new ColorConverter();
		String spaceBg = "-".repeat(81);
        String spaceText = buildString(30, "-", "~");
        String spaceTextInv = 
		spaceText.replace("-", "temp")
        .replace("~", "-")
        .replace("temp", "~");
        
        //Content
			String content = 
			colorConverter.style(spaceBg + "\n", "white", "bold") +
			colorConverter.style(spaceText, "white", "bold") +
			colorConverter.style("   Messages Server   ", "blue", "bold") +
			colorConverter.style(spaceTextInv + "\n", "white", "bold") +
			colorConverter.style(spaceBg + "\n", "white", "bold") +

			colorConverter.style("Server starting on port ", "magenta", "italic") +
			colorConverter.style(buildBaseUrl(), "white", "blink") +
			colorConverter.style("!!! ;)", "magenta", "italic");
		//
        
        System.out.println(content);
	}

	private static String buildString(
		int length,
		String fChar,
		String sChar
	) {
		StringBuilder sb = new StringBuilder();
		for(int i = 0; i < length; i++) sb.append(i % 2 == 0 ? fChar : sChar);
		return sb.toString();
	}

	@Bean
	public ColorConverter colorConverter() {
		return new ColorConverter();
	}
}
