var amqp = require('amqplib/callback_api');
var amqp_url = require('../properties.json').amqp.url;
var _ = require("underscore");
var InfraccionesJssm = require('../maquinas/infraccionJssmImpl');
// var Steper = require('../Steper');
// var steper = new Steper(process.argv[2]);
var SteperSocketJson = require('../SteperSocketJson');
var steperSocketJson = new SteperSocketJson(process.argv[2]);

// para manejar la persistencia de los datos
var AdminBackups = require('../mom/adminBackups');
var adminBackups = new AdminBackups();

var infraccionesDB = new Array();
var infraccion;

// var MonitorServer = require('../monitorServer');
// var monitor = new MonitorServer(steper,infraccionesDB);
var MonitorServerSocketJson = require('../monitorServerSocketJson');
// var monitor = new MonitorServerSocketJson(steper,infraccionesDB);
var monitor = new MonitorServerSocketJson(steperSocketJson,infraccionesDB);

// ############################################################
// ############### recuperacion del servidor ##################
var recuperarServer = process.argv[3];
if(typeof(recuperarServer) != 'undefined'){
  recuperarInfoDB();
}
// ############################################################

amqp.connect(amqp_url, function(err, conn) {
  conn.createChannel(function(err, ch) {
    var q = 'infracciones';

    ch.assertQueue(q, {durable: true});
    console.log(" [*] Esperando mensajes en %s. Para salir presione CTRL+C", q);
    ch.consume(q, function(msg) {
      var evento = JSON.parse(msg.content.toString());
      //console.log('se recibió el mensaje: ',evento);
      console.log('==> [INFRACCIONES]: se recibe la tarea  *** ',evento.tarea,' ***');

      // ################################################################
      // ########################### MODO STEP ##########################
      var dataIngreso = {
        id: evento.data.compraId,
        accion: 'INGRESA',
        tarea: null
      }
      dataIngreso.tarea = evento.tarea;
      // ################################################################

      infraccion = _.find(infraccionesDB,function (compra) {
        return compra.compra.compraId == evento.data.compraId;
      });

      if (!infraccion) {
        //console.log('simuladorInfraccionesCC: ingresa a nueva infraccion');
        console.log('[o] [INFRACCIONES]: se crea una nueva infraccion con data: ',evento.data);
        infraccion = new InfraccionesJssm();
        infraccion.compra = evento.data;
        infraccionesDB.push(infraccion);
      }

      // ################################################################
      // ########################### MODO STEP ##########################
      if(steperSocketJson.modo == 'step'){
        monitor.ioServerMonitor.sockets.emit('mon-ingreso-tarea', dataIngreso);
      }
      // ################################################################

      // steper.emit('step',infraccion,evento.tarea,evento.data);
      steperSocketJson.emit('step',infraccion,evento.tarea,evento.data);
      ch.ack(msg);

      // ################################################################
      var tareas_pend = infraccion.stepsQ;   // actualizamos las tareas

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
adminBackups.saveData(infraccionesDB);
// ################################################################

function recuperarInfoDB(){
  adminBackups.getDataDbPromise('INFRACCIONES').then(function(result){
    console.log("Rdo de la promise en INFRACCIONES");
    console.log(result);

    var arrayObjectJssm = result.data_jssm;

    //vamos llenando la lista con las compras ya creadas, las objectJssm creados
    for (let i = 0; i < arrayObjectJssm.length; i++) {
      const datosObjectWeb = arrayObjectJssm[i];
      infraccion = new InfraccionesJssm();  // creamos la nueva maquina
      // seteamos los valores
      infraccion.compra = datosObjectWeb.data_compra;
      infraccion._fsm.state = datosObjectWeb.current_status;
      infraccion.history = datosObjectWeb.history;
      infraccionesDB.push(infraccion);
    }

    // mandar mje al server pug de serv recuperado (ver que info mandar en el mje)

  });
}

monitor.serverIO.listen(6001, function () {
  console.log('Servidor MONITOR-IO de compras escuchando en localhost:6001..')
})

// }
// module.exports = SimuladorInfracciones;