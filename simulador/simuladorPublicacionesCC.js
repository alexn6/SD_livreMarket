var amqp = require('amqplib/callback_api');
var amqp_url = require('../properties.json').amqp.url;
var _ = require("underscore");
var PublicacionesJssm = require('../maquinas/publicacionesJssmImpl');
// var Steper = require('../Steper');
// var steper = new Steper(process.argv[2]);

var SteperSocketJson = require('../SteperSocketJson');
var steperSocketJson = new SteperSocketJson(process.argv[2]);

// para manejar la persistencia de los datos
var AdminBackups = require('../mom/adminBackups');
var adminBackups = new AdminBackups();

var PublicacionesDB = new Array();
var publicacion;

// var MonitorServer = require('../monitorServer');
// var monitor = new MonitorServer(steper,PublicacionesDB);
var MonitorServerSocketJson = require('../monitorServerSocketJson');
// var monitor = new MonitorServerSocketJson(steper,PublicacionesDB);
// var monitor = new MonitorServerSocketJson(steperSocketJson,PublicacionesDB);

// ############################################################
// ############### recuperacion del servidor ##################
var recuperarServer = process.argv[3];
var recuperacion = false;
if(typeof(recuperarServer) != 'undefined'){
  recuperacion = true;
  recuperarInfoDB();
}
// ############################################################

var monitor = new MonitorServerSocketJson(steperSocketJson, PublicacionesDB, recuperacion);

amqp.connect(amqp_url, function(err, conn) {
  conn.createChannel(function(err, ch) {
    var q = 'publicaciones';

    ch.assertQueue(q, {durable: true});
    console.log(" [*] Esperando mensajes en %s. Para salir presione CTRL+C", q);
    ch.consume(q, function(msg) {
      var evento = JSON.parse(msg.content.toString());
      // console.log('se recibió el mensaje: ',evento);
      console.log('==> [PUBLICACIONES]: se recibe la tarea  *** ',evento.tarea,' ***');

      // ################################################################
      // ########################### MODO STEP ##########################
      var dataIngreso = {
        id: evento.data.compraId,
        accion: 'INGRESA',
        tarea: null
      }
      dataIngreso.tarea = evento.tarea;
      // ################################################################

      publicacion = _.find(PublicacionesDB,function (compra) {
        return compra.compra.compraId == evento.data.compraId;
      });

      if (!publicacion) {
        console.log('simuladorPublicacionesCC: ingresa a nueva publicacion');
        publicacion = new PublicacionesJssm();
        publicacion.compra = evento.data;
        PublicacionesDB.push(publicacion);
      }

      // ################################################################
      // ########################### MODO STEP ##########################
      if(steperSocketJson.modo == 'step'){
        monitor.ioServerMonitor.sockets.emit('mon-ingreso-tarea', dataIngreso);
      }
      // ################################################################

      // steper.emit('step',publicacion,evento.tarea,evento.data);
      steperSocketJson.emit('step',publicacion,evento.tarea,evento.data);
      ch.ack(msg);

      // ################################################################
      var tareas_pend = publicacion.stepsQ;   // actualizamos las tareas

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
adminBackups.saveData(PublicacionesDB);
// ################################################################

function recuperarInfoDB(){
  adminBackups.getDataDbPromise('PUBLICACIONES').then(function(result){
    // console.log("Rdo de la promise en PUBLICACIONES");
    // console.log(result);

    if(result == null){
      console.log("[RECU_DB]: No hay datos en la DB");
      return;
    }

    var arrayObjectJssm = result.data_jssm;

    //vamos llenando la lista con las compras ya creadas, las objectJssm creados
    for (let i = 0; i < arrayObjectJssm.length; i++) {
      const datosObjectWeb = arrayObjectJssm[i];
      publicacion = new PublicacionesJssm();  // creamos la nueva maquina
      // seteamos los valores
      publicacion.compra = datosObjectWeb.data_compra;
      publicacion._fsm.state = datosObjectWeb.current_status;
      publicacion.history = datosObjectWeb.history;
      PublicacionesDB.push(publicacion);
    }

  });
}

monitor.serverIO.listen(6003, function () {
  console.log('Servidor MONITOR-IO de publicaciones escuchando en localhost:6003..')
})