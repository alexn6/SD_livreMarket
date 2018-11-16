var EventEmitter = require('events').EventEmitter;
var util = require('util');
var steps;

module.exports= SteperSocketJson;

function SteperSocketJson(modo) {

  this.modo = modo || 'normal';
  this.stepsQ = [];
  this.cantManualStep = 0;
  // this.dataStepQ = [];

  console.log('Steper arranca en modo --> ',this.modo);

  this.on('step',function (jssmObject,transition,data) {
    
    if (this.modo == 'normal') {
      console.log('[>][',jssmObject.nombreSimulador,'] Ejecucion: TRANSICION = ',transition,' - MODO = ',this.modo,' - DATOS: ',data);
    }
    
    try {
      if (this.modo == 'normal') {
        steps = jssmObject[transition](data);
      } else {
        console.log("Se guarda la trans: "+transition);
        // console.log(data);
        jssmObject.stepsQ.push(transition);
        jssmObject.dataStepQ[transition] = data;
        // console.log(jssmObject);
      }

      // console.log('steps --> ',steps);
      console.log('[-][',jssmObject.nombreSimulador,']: transiciones pendientes  ==> ',steps);
      if (steps) {
        // Se ejecutan las transiciones generadas
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

  // evento que escucha el paso a paso (compra step 0 -> desde el distributedMonitor)
  this.on('manualStep',function (jssmObject) {
    this.cantManualStep++;
    console.log("###########************** EJECUCION MANUAL STEP ["+this.cantManualStep+"] ###########**************");
    console.log(jssmObject.stepsQ);
    // se consume la 1ra transicion guardada
    var transition = jssmObject.stepsQ.shift();
    if (transition) {
      // cada vez q se ejecuta una transicion mandamos la info al cliente web
      // cambiar el evento
      //ioSocketMonitor.sockets.emit('resp-mje-getAllCompras', "[>][TRANSICION]: Se ejecuta === "+transition+" ===");
      this.emit('ejec_trans', "[>][TRANSICION]: Se ejecuta === "+transition+" ===");
      try {
        console.log(" [MANUAL STEP]: => Se ejecuta === "+transition+" ===");
        console.log(" [MANUAL STEP]: *********** Datos *********** ");
        // si los datso = undefined entonces no se recibe una tarea
        // solo se ejecuta una transicion
        console.log(jssmObject.dataStepQ[transition]);
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

util.inherits(SteperSocketJson,EventEmitter);
