# Servicio de IA en SWI-Prolog (decisiones de la computadora en el Combate).
# docker build -t gameconsole-prolog prolog
FROM swipl:9.2.9

WORKDIR /app
COPY combate.pl servidor.pl pruebas.pl ./

# Las pruebas de las reglas corren al construir: si fallan, no hay imagen.
RUN swipl -g run_tests -t halt pruebas.pl

ENV PORT=8081
EXPOSE 8081
CMD ["swipl", "servidor.pl"]
