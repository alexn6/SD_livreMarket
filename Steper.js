var EventEmitter = require('events').EventEmitter;
var util = require('util');
var steps;

module.exports= Steper;

function Steper(modo) {

  this.modo = modo || 'normal';
  this.stepsQ = [];
  this.dataStepQ = [];

  console.log('Steper arranca en modo --> ',this.modo);

  this.on('step',function (jssmObject,transition,data) {
    console.log('Steper: Se dispara la transición ',transition,' en modo : ',this.modo,' con data: ',data);
    try {
      if (this.modo == 'normal') {
        steps = jssmObject[transition](data);
      } else {
        console.log("=== Se entro en modo STEP: se guardan la transicion y los datos recibidos ===");
        jssmObject.stepsQ.push(transition);
        jssmObject.dataStepQ[transition] = data;
      }

      console.log('steps --> ',steps);
      if (steps) {
        // se requiere ejecutar la lista de transiciones luego de este paso
        for (const step of steps) {
          // ejecuta cada transición esperada. Es problema del retorno de la transición actual con qué seguir
          //console.log('Steper: se dispara paso recursivo'step);
          this.emit('step',jssmObject, step,jssmObject.compra);
        }
      }
    } catch (e) {
      if (e.toString().includes('is not a function')) {
        console.log('Error en steper "manualStep" --> ',transition,' transición FMS no implementada');
      } else {
        console.log('Error en steper "manualStep" --> stacktrace: ',e);
      }
    }

  });

  this.on('manualStep',function (jssmObject) {
    var transition = jssmObject.stepsQ.shift();
    // console.log("Entro en modo MANUAL.");
    if (transition) {
      //console.log("Se entro en la transicion<"+transition+"> con los datos: "+jssmObject.compra);
      //console.log(jssmObject.compra);
      try {
        //steps = jssmObject[transition](jssmObject.compra);
        steps = jssmObject[transition](jssmObject.dataStepQ[transition]);
        if (steps) {
          // se requiere ejecutar la lista de transiciones luego de este paso
          for (const step of steps) {
            // ejecuta cada transición esperada. Es problema del retorno de la transición actual con qué seguir
            //console.log('Steper: se dispara paso recursivo'step);
            jssmObject.stepsQ.push(step);
          }
        }
      } catch (e) {
        if (e.toString().includes('is not a function')) {
          console.log('Error en steper "manualStep" --> ',transition,' transición FMS no implementada');
        } else {
          console.log('Error en steper "manualStep" --> stacktrace: ',e);
        }

      }
    }

  });

}

util.inherits(Steper,EventEmitter);
