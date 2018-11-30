var amqp = require('amqplib/callback_api');
var amqp_url = require('../properties.json').amqp.url;
var _ = require("underscore");
var EnviosJssm = require('../maquinas/enviosJssmImpl');
// var Steper = require('../Steper');
// var steper = new Steper(process.argv[2]);
var SteperSocketJson = require('../SteperSocketJson');
var steperSocketJson = new SteperSocketJson(process.argv[2]);

// para manejar la persistencia de los datos
var AdminBackups = require('../mom/adminBackups');
var adminBackups = new AdminBackups();

var enviosDB = new Array();
var envio;

// var MonitorServer = require('../monitorServer');
// var monitor = new MonitorServer(steper,enviosDB);
var MonitorServerSocketJson = require('../monitorServerSocketJson');
// var monitor = new MonitorServerSocketJson(steper,enviosDB);
var monitor = new MonitorServerSocketJson(steperSocketJson,enviosDB);

// ############################################################
// ############### recuperacion del servidor ##################
var recuperarServer = process.argv[3];
if(typeof(recuperarServer) != 'undefined'){
  recuperarInfoDB();
}
// ############################################################

amqp.connect(amqp_url, function(err, conn) {
  conn.createChannel(function(err, ch) {
    var q = 'envios';

    ch.assertQueue(q, {durable: true});
    console.log(" [*] Esperando mensajes en %s. Para salir presione CTRL+C", q);
    ch.consume(q, function(msg) {
      var evento = JSON.parse(msg.content.toString());
      //console.log('se recibió el mensaje: ',evento);
      console.log('==> [ENVIOS]: se recibe la tarea  *** ',evento.tarea,' ***');

      // ################################################################
      // ########################### MODO STEP ##########################
      var dataIngreso = {
        id: evento.data.compraId,
        accion: 'INGRESA',
        tarea: null
      }
      dataIngreso.tarea = evento.tarea;
      // ################################################################

      envio = _.find(enviosDB,function (compra) {
        return compra.compra.compraId == evento.data.compraId;
      });

      if (!envio) {
        // console.log('simuladorEnviosCC: ingresa un nuevo envio');
        console.log('[o] [ENVIOS]: se crea un nuevo envio con data: ',evento.data);
        envio = new EnviosJssm();
        envio.compra = evento.data;
        enviosDB.push(envio);
      }

      // ################################################################
      // ########################### MODO STEP ##########################
      if(steperSocketJson.modo == 'step'){
        monitor.ioServerMonitor.sockets.emit('mon-ingreso-tarea', dataIngreso);
      }
      // ################################################################

      // steper.emit('step',envio,evento.tarea,evento.data);
      steperSocketJson.emit('step',envio,evento.tarea,evento.data);
      ch.ack(msg);

      // ################################################################
      var tareas_pend = envio.stepsQ;   // actualizamos las tareas

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
adminBackups.saveData(enviosDB);
// ################################################################

function recuperarInfoDB(){
  adminBackups.getDataDbPromise('ENVIOS').then(function(result){
    console.log("Rdo de la promise en ENVIOS");
    console.log(result);

    var arrayObjectJssm = result.data_jssm;

    //vamos llenando la lista con las compras ya creadas, las objectJssm creados
    for (let i = 0; i < arrayObjectJssm.length; i++) {
      const datosObjectWeb = arrayObjectJssm[i];
      envio = new EnviosJssm();  // creamos la nueva maquina
      // seteamos los valores
      envio.compra = datosObjectWeb.data_compra;
      envio._fsm.state = datosObjectWeb.current_status;
      envio.history = datosObjectWeb.history;
      enviosDB.push(envio);
    }

    // mandar mje al server pug de serv recuperado (ver que info mandar en el mje)

  });
}

monitor.serverIO.listen(6005, function () {
  console.log('Servidor MONITOR-IO de compras escuchando en localhost:6005..')
})

// }
// module.exports = SimuladorEnvios;