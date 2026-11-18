/*  pruebas.pl — Pruebas de las reglas de la IA (plunit).

    Ejecutar:  swipl -g run_tests -t halt pruebas.pl
*/
:- use_module(library(plunit)).
:- use_module(combate).

% Estado base: lejos, vidas llenas, nadie ataca. Cada prueba cambia lo que necesita.
estado(Cambios, Estado) :-
    Base = [ distancia-300, mi_vida-100, rival_vida-100, mi_espera-0,
             rival_atacando-ninguno, rival_bloqueando-false, rival_en_aire-false,
             en_esquina-false, tiempo-50 ],
    foldl(cambiar, Cambios, Base, Estado).

cambiar(K-V, Antes, Despues) :- selectchk(K-_, Antes, Resto), Despues = [K-V | Resto].

:- begin_tests(combate).

test(lejos_se_acerca) :-
    estado([], E), once(decidir(E, A, _)), A == acercarse.

test(rival_ataca_de_cerca_bloquea) :-
    estado([distancia-60, rival_atacando-golpe], E), once(decidir(E, A, _)), A == bloquear.

test(remata_si_puede_noquear) :-
    estado([distancia-60, rival_vida-8], E), once(decidir(E, A, R)),
    memberchk(A, [golpe, patada]), R == 'puedo noquearlo con este ataque'.

test(al_alcance_ataca) :-
    estado([distancia-60], E), once(decidir(E, A, _)), memberchk(A, [golpe, patada]).

test(siempre_hay_una_decision, [nondet]) :-
    forall(member(D, [10, 60, 95, 150, 400]),
           ( estado([distancia-D], E), once(decidir(E, _, _)) )).

:- end_tests(combate).
