var amqp = require('amqplib/callback_api');
var amqp_url = require('../properties.json').amqp.url;
var _ = require("underscore");
var PagosJssm = require('../maquinas/pagoJssmImpl');
// var Steper = require('../Steper');
// var steper = new Steper(process.argv[2]);
var SteperSocketJson = require('../SteperSocketJson');
var steperSocketJson = new SteperSocketJson(process.argv[2]);

// para manejar la persistencia de los datos
var AdminBackups = require('../mom/adminBackups');
var adminBackups = new AdminBackups();

var PagosDB = new Array();
var pago;

// var MonitorServer = require('../monitorServer');
// var monitor = new MonitorServer(steper,PagosDB);
var MonitorServerSocketJson = require('../monitorServerSocketJson');
// var monitor = new MonitorServerSocketJson(steper,PagosDB);
// var monitor = new MonitorServerSocketJson(steperSocketJson,PagosDB);

// ############################################################
// ############### recuperacion del servidor ##################
var recuperarServer = process.argv[3];
var recuperacion = false;
if(typeof(recuperarServer) != 'undefined'){
  recuperacion = true;
  recuperarInfoDB();
}
// ############################################################

var monitor = new MonitorServerSocketJson(steperSocketJson, PagosDB, recuperacion);

amqp.connect(amqp_url, function(err, conn) {
  conn.createChannel(function(err, ch) {
    // la cola a la que se suscribe el simulador
    var q = 'pagos';

    ch.assertQueue(q, {durable: true});
    console.log(" [*] Esperando mensajes en %s. Para salir presione CTRL+C", q);
    ch.consume(q, function(msg) {
      var evento = JSON.parse(msg.content.toString());
      //console.log('se recibió el mensaje: ',evento);
      console.log('==> [PAGOS]: se recibe la tarea  *** ',evento.tarea,' ***');

      // ################################################################
      // ########################### MODO STEP ##########################
      var dataIngreso = {
        id: evento.data.compraId,
        accion: 'INGRESA',
        tarea: null
      }
      dataIngreso.tarea = evento.tarea;
      // ################################################################

      pago = _.find(PagosDB,function (compra) {
        return compra.compra.compraId == evento.data.compraId;
      });

      if (!pago) {
        //console.log('simuladorPagosCC: ingresa a nueva infraccion');
        console.log('[o] [PAGOS]: se crea un nuevo pago con data: ',evento.data);
        pago = new PagosJssm();
        pago.compra = evento.data;
        PagosDB.push(pago);
      }

      // ################################################################
      // ########################### MODO STEP ##########################
      if(steperSocketJson.modo == 'step'){
        monitor.ioServerMonitor.sockets.emit('mon-ingreso-tarea', dataIngreso);
      }
      // ################################################################

      // steper.emit('step',pago,evento.tarea,evento.data);
      steperSocketJson.emit('step', pago,evento.tarea,evento.data);
      ch.ack(msg);

      // ################################################################
      var tareas_pend = pago.stepsQ;   // actualizamos las tareas

      // ################################################################
      // ########################### MODO STEP ##########################
      if(steperSocketJson.modo == 'step'){
        monitor.ioServerMonitor.sockets.emit('update-tareas-pend', tareas_pend);
      }
      // ################################################################

    }, {noAck: false});
  });
});

// ################################################################
// #################### PARCHE PERSISTENCIA #######################
adminBackups.saveData(PagosDB);
// ################################################################

function recuperarInfoDB(){
  adminBackups.getDataDbPromise('PAGOS').then(function(result){
    // console.log("Rdo de la promise en PAGOS");
    // console.log(result);

    if(result == null){
      console.log("[RECU_DB]: No hay datos en la DB");
      return;
    }

    var arrayObjectJssm = result.data_jssm;

    //vamos llenando la lista con las compras ya creadas, las objectJssm creados
    for (let i = 0; i < arrayObjectJssm.length; i++) {
      const datosObjectWeb = arrayObjectJssm[i];
      pago = new PagosJssm();  // creamos la nueva maquina
      // seteamos los valores
      pago.compra = datosObjectWeb.data_compra;
      pago._fsm.state = datosObjectWeb.current_status;
      pago.history = datosObjectWeb.history;
      PagosDB.push(pago);
    }

  });
}

monitor.serverIO.listen(6004, function () {
  console.log('Servidor MONITOR-IO de compras escuchando en localhost:6004..')
})