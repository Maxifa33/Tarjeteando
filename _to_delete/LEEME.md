# Archivos obsoletos — borrar a mano

Estos dos archivos eran el motor de cuotas del backend. Quedaron sin uso al mover la
calculadora a `Frontend/src/services/cuotas.js` (única fuente de verdad, testeada con
`npm test` en Frontend).

- `proyeccion.service.js.obsoleto` — antes `Backend/src/services/proyeccion.service.js`
- `proyeccion.test.js.obsoleto` — antes `Backend/tests/proyeccion.test.js`; su cobertura
  está portada y ampliada en `Frontend/src/services/cuotas.test.js`

Se les cambió la extensión para que ni `require()` ni jest los levanten. Nada del
código los referencia. Borrá esta carpeta entera cuando quieras.
