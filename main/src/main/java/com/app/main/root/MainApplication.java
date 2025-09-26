package com.app.main.root;
import com.app.main.root.app._data.ConfigSocketEvents;
import com.app.main.root.app._utils.ColorConverter;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;

@SpringBootApplication
public class MainApplication implements CommandLineRunner {
	@Autowired
	private ConfigSocketEvents configSocketEvents;

	public static void main(String[] args) {
		SpringApplication.run(MainApplication.class, args);
	}

	@Override
	public void run(String... args) throws Exception {
		configSocketEvents.configSocketEvents();
	}

	@Bean
	public ColorConverter colorConverter() {
		return new ColorConverter();
	}
}
