/*  combate.pl — La "cabeza" del luchador de la computadora.

    Recibe una foto del momento (distancias, vidas, qué hace el rival...) y decide
    UNA acción con su razón. No hay nada al azar: son reglas ordenadas por prioridad
    y, para elegir el ataque, una pequeña búsqueda que compara el valor de cada opción.

    Acciones posibles: acercarse, alejarse, saltar, bloquear, golpe, patada, esperar.

    Hechos del estado (los arma el servidor a partir del JSON):
      distancia(D)          píxeles entre los centros de los luchadores
      mi_vida(V)            rival_vida(V)          0..100
      mi_espera(S)          segundos que me faltan para poder atacar otra vez
      rival_atacando(A)     ninguno | golpe | patada
      rival_bloqueando(B)   true | false
      rival_en_aire(B)      true | false
      en_esquina(B)         true si tengo la pared detrás (no puedo alejarme)
      tiempo(T)             segundos que le quedan a la ronda
*/
:- module(combate, [decidir/3, ataque/4]).

% ---------- Datos de los ataques (los mismos del juego en JavaScript) ----------
%   ataque(Tipo, Alcance, Dano, Espera)
ataque(golpe,  80,  8, 0.35).
ataque(patada, 105, 14, 0.80).

% Daño que hace un ataque si el rival bloquea (se divide entre 5, redondeado hacia arriba).
dano_real(Tipo, true,  D) :- ataque(Tipo, _, D0, _), D is ceiling(D0 / 5).
dano_real(Tipo, false, D) :- ataque(Tipo, _, D, _).

% ---------- Ayudas ----------
puedo_atacar(E)  :- mi_espera(S, E), S =:= 0.
en_alcance(Tipo, E) :- ataque(Tipo, Alcance, _, _), distancia(D, E), D =< Alcance.
peligro(E) :-                         % el rival me está pegando y estoy cerca
    rival_atacando(A, E), A \== ninguno,
    ataque(A, Alcance, _, _), distancia(D, E), D =< Alcance + 15.
voy_perdiendo(E) :- mi_vida(M, E), rival_vida(R, E), M + 20 =< R.
vida_baja(E) :- mi_vida(M, E), M =< 30.

% Lectura del estado: Estado es una lista de pares Clave-Valor.
distancia(D, E)        :- memberchk(distancia-D, E).
mi_vida(V, E)          :- memberchk(mi_vida-V, E).
rival_vida(V, E)       :- memberchk(rival_vida-V, E).
mi_espera(S, E)        :- memberchk(mi_espera-S, E).
rival_atacando(A, E)   :- memberchk(rival_atacando-A, E).
rival_bloqueando(B, E) :- memberchk(rival_bloqueando-B, E).
rival_en_aire(B, E)    :- memberchk(rival_en_aire-B, E).
en_esquina(B, E)       :- memberchk(en_esquina-B, E).
tiempo(T, E)           :- memberchk(tiempo-T, E).

% ---------- Búsqueda del mejor ataque ----------
% valor(Tipo, E, V): cuánto conviene un ataque ahora. Considera daño real (si el rival
% bloquea), si con eso lo noqueo, y el riesgo de quedarme mucho tiempo sin poder atacar.
valor(Tipo, E, V) :-
    en_alcance(Tipo, E),
    rival_bloqueando(B, E),
    dano_real(Tipo, B, D),
    ataque(Tipo, _, _, Espera),
    rival_vida(R, E),
    ( D >= R -> Bono = 100 ; Bono = 0 ),          % ¡lo noquea!
    ( peligro(E) -> Riesgo = Espera * 10 ; Riesgo = Espera * 4 ),
    V is D + Bono - Riesgo.

mejor_ataque(E, Mejor, V) :-
    findall(V0-T, valor(T, E, V0), Opciones),
    Opciones \== [],
    max_member(V-Mejor, Opciones).

% ---------- Reglas de decisión (en orden de prioridad) ----------
% decidir(+Estado, -Accion, -Razon)

% 1. Si con un ataque lo dejo KO, no lo pienso dos veces.
decidir(E, Ataque, 'puedo noquearlo con este ataque') :-
    puedo_atacar(E),
    mejor_ataque(E, Ataque, V), V >= 100, !.

% 2. Si el rival me está atacando de cerca, me cubro.
decidir(E, bloquear, 'el rival esta atacando de cerca: me cubro') :-
    peligro(E), !.

% 3. Voy perdiendo y tengo poca vida: tomo distancia (si no estoy contra la pared).
decidir(E, alejarse, 'voy perdiendo y tengo poca vida: tomo distancia') :-
    vida_baja(E), voy_perdiendo(E),
    en_esquina(false, E),
    distancia(D, E), D < 140, !.

% 3b. ...y si estoy contra la pared, salto para salir de la esquina.
decidir(E, saltar, 'estoy acorralado contra la pared: salto para escapar') :-
    vida_baja(E), voy_perdiendo(E),
    en_esquina(true, E),
    distancia(D, E), D < 90, !.

% 4. Si el rival se cubre, no gasto ataques: espero a que baje la guardia.
decidir(E, esperar, 'el rival esta bloqueando: espero a que baje la guardia') :-
    rival_bloqueando(true, E),
    distancia(D, E), D =< 105, !.

% 5. Si puedo atacar y tengo un ataque al alcance, uso el que más conviene.
decidir(E, Ataque, 'tengo al rival al alcance: uso el ataque que mas conviene') :-
    puedo_atacar(E),
    mejor_ataque(E, Ataque, V), V > 0, !.

% 6. Estoy recargando y muy cerca: me alejo un poco para no recibir golpes gratis.
decidir(E, alejarse, 'estoy recargando el ataque: me alejo un poco') :-
    \+ puedo_atacar(E),
    en_esquina(false, E),
    distancia(D, E), D < 60, !.

% 7. Si voy ganando y queda poco tiempo, me alejo y dejo correr el reloj.
decidir(E, alejarse, 'voy ganando y queda poco tiempo: dejo correr el reloj') :-
    mi_vida(M, E), rival_vida(R, E), M > R,
    tiempo(T, E), T < 8,
    en_esquina(false, E), !.

% 8. Si el rival está lejos, me acerco.
decidir(E, acercarse, 'el rival esta lejos: me acerco') :-
    distancia(D, E), D > 80, !.

% 9. Si no hay nada mejor, espero.
decidir(_, esperar, 'nada que hacer por ahora: espero').
