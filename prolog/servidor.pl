/*  servidor.pl — Servicio HTTP de la IA (SWI-Prolog).

    Ejecutar:   swipl servidor.pl            (puerto 8081, o la variable PORT)

    POST /combate/decision
      cuerpo:    {"distancia":120,"miVida":80,"rivalVida":60,"miEspera":0,
                  "rivalAtacando":"ninguno","rivalBloqueando":false,"rivalEnAire":false,
                  "enEsquina":false,"tiempo":42}
      respuesta: {"accion":"acercarse","razon":"el rival esta lejos: me acerco","ms":0.1}

    GET /health  →  {"ok":true}

    Este archivo es el ADAPTER del lado de Prolog: traduce el JSON que llega de JavaScript
    a hechos que entiende combate.pl, y la respuesta de Prolog otra vez a JSON.
*/
:- use_module(library(http/thread_httpd)).
:- use_module(library(http/http_dispatch)).
:- use_module(library(http/http_json)).
:- use_module(library(http/http_cors)).
:- use_module(combate).

:- set_setting(http:cors, [*]).

:- http_handler(root(health), salud, []).
:- http_handler(root(combate/decision), decision_combate, []).

salud(Peticion) :-
    cors_enable(Peticion, [methods([get, post, options])]),
    reply_json_dict(_{ok: true, servicio: "prolog", juegos: ["combate"]}).

decision_combate(Peticion) :-
    memberchk(method(options), Peticion), !,
    cors_enable(Peticion, [methods([post, options])]),
    format("~n").
decision_combate(Peticion) :-
    cors_enable(Peticion, [methods([post, options])]),
    catch(( http_read_json_dict(Peticion, Json),
            a_estado(Json, Estado),
            statistics(cputime, T0),
            decidir(Estado, Accion, Razon),
            statistics(cputime, T1),
            Ms is round((T1 - T0) * 1000000) / 1000,
            reply_json_dict(_{accion: Accion, razon: Razon, ms: Ms})
          ),
          Error,
          ( term_string(Error, Texto),
            reply_json_dict(_{error: Texto}, [status(400)]) )).

% JSON (dict) → lista Clave-Valor que usa combate.pl. Si falta algo, valor por defecto.
a_estado(J, [ distancia-D, mi_vida-MV, rival_vida-RV, mi_espera-ME,
              rival_atacando-RA, rival_bloqueando-RB, rival_en_aire-RE,
              en_esquina-EQ, tiempo-T ]) :-
    num(J, distancia, 999, D),
    num(J, miVida, 100, MV),
    num(J, rivalVida, 100, RV),
    num(J, miEspera, 0, ME),
    atomo(J, rivalAtacando, ninguno, RA0), ( memberchk(RA0, [golpe, patada]) -> RA = RA0 ; RA = ninguno ),
    bool(J, rivalBloqueando, RB),
    bool(J, rivalEnAire, RE),
    bool(J, enEsquina, EQ),
    num(J, tiempo, 60, T).

num(J, K, Def, V)   :- ( get_dict(K, J, V0), number(V0) -> V = V0 ; V = Def ).
atomo(J, K, Def, V) :- ( get_dict(K, J, V0), (atom(V0) ; string(V0)) -> atom_string(V, V0) ; V = Def ).
bool(J, K, V)       :- ( get_dict(K, J, true) -> V = true ; V = false ).

puerto(P) :- ( getenv('PORT', S), atom_number(S, P) -> true ; P = 8081 ).

iniciar :-
    puerto(P),
    http_server(http_dispatch, [port(P)]),
    format("IA de Prolog escuchando en http://localhost:~w~n", [P]).

:- initialization((iniciar, thread_get_message(_)), main).
