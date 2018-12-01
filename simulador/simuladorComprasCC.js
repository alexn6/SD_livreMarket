var amqp = require('amqplib/callback_api');
var amqp_url = require('../properties.json').amqp.url;

var _ = require('underscore');
var ComprasJssm = require('../maquinas/compraJssmImpl');
// var Steper = require('../Steper');
// var steper = new Steper(process.argv[2]);
var SteperSocketJson = require('../SteperSocketJson');
var steperSocketJson = new SteperSocketJson(process.argv[2]);

// para manejar la persistencia de los datos
var AdminBackups = require('../mom/adminBackups');
var adminBackups = new AdminBackups();

var comprasDB = new Array();
var compraSec = 0;
var compra;

// var MonitorServer = require('../monitorServer');
// var monitor = new MonitorServer(steper,comprasDB);
var MonitorServerSocketJson = require('../monitorServerSocketJson');
//var monitor = new MonitorServerSocketJson(steper,comprasDB);
// var monitor = new MonitorServerSocketJson(steperSocketJson,comprasDB);

// ############################################################
// ############### recuperacion del servidor ##################
var recuperarServer = process.argv[3];
var recuperacion = false;
if(typeof(recuperarServer) != 'undefined'){
  recuperacion = true;
  recuperarInfoDB();
}
// ############################################################

// var monitor = new MonitorServerSocketJson(steperSocketJson,comprasDB);
var monitor = new MonitorServerSocketJson(steperSocketJson, comprasDB, recuperacion);

amqp.connect(amqp_url, function(err, conn) {
  conn.createChannel(function(err, ch) {

    var q = 'compras';

    ch.consume(q, function(msg) {
      var evento = JSON.parse(msg.content.toString());
      // console.log('se recibió el mensaje: ',evento);
      console.log('==> [COMPRAS]: se recibe la tarea  *** ',evento.tarea,' ***');
      // ################################################################
      // ########################### MODO STEP ##########################
      var dataIngreso = {
        id: evento.data.compraId,
        accion: 'INGRESA',
        tarea: null
      }
      dataIngreso.tarea = evento.tarea;
      // ################################################################

      compra = _.find(comprasDB,function (compra) {
        return compra.compra.compraId == evento.data.compraId;
      });

      // primero recupera, si existe, la compra. Si no existe crea una nueva
      if (!compra) {
        compra = new ComprasJssm();
        
        // esto lo hace por si no se recibe un id de lacompra
        if (typeof(evento.data.compraId) == 'undefined') {
          evento.data.compraId = compraSec++;
          compra.compra.compraId = evento.data.compraId;
        }
        console.log('[o] [COMPRAS]: se crea una nueva compra ['+compra.compra.compraId+'] con data: ',evento.data);
        compra.compra = evento.data;
        comprasDB.push(compra);

        // ################################################################
        // ########################### MODO STEP ##########################
        // actualizamos la cant de cmpras
        if(steperSocketJson.modo == 'step'){
          monitor.ioServerMonitor.sockets.emit('update-cant-compras', comprasDB.length);
        }
        // ################################################################

        //console.log('DB Compras: ',comprasDB);
      }

      // ################################################################
      // ########################### MODO STEP ##########################
      if(steperSocketJson.modo == 'step'){
        monitor.ioServerMonitor.sockets.emit('detalle-mje-getAllCompras', dataIngreso);
      }
      // ################################################################

      // mando a ejecutar o guardar la tarea
      // steper.emit('step',compra,evento.tarea,evento.data);
      steperSocketJson.emit('step',compra,evento.tarea,evento.data);
      ch.ack(msg);

      // ################################################################
      // se envia la misma info al SERVER PUG (solo en modo NORMAL)
      if(steperSocketJson.modo == 'normal'){
        monitor.ioServerMonitor.sockets.emit('detalle-mje-getAllCompras', '[>] [TRANSICION] : se ejecuta '+evento.tarea+' - datos: '+evento.data);
      }
      // ################################################################
      // actualizamos las tareas
      var tareas_pend = compra.stepsQ;

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
adminBackups.saveData(comprasDB);   // se ejecuta cada minuto
// ################################################################

function recuperarInfoDB(){
  adminBackups.getDataDbPromise('COMPRAS').then(function(result){
    // console.log("Rdo de la promise en COMPRAS");
    // console.log(result);

    if(result == null){
      console.log("[RECU_DB]: No hay datos en la DB");
      return;
    }

    var arrayObjectJssm = result.data_jssm;

    //vamos llenando la lista con las compras ya creadas, las objectJssm creados
    for (let i = 0; i < arrayObjectJssm.length; i++) {
      const datosObjectWeb = arrayObjectJssm[i];
      compra = new ComprasJssm();  // creamos la nueva maquina
      // seteamos los valores
      compra.compra = datosObjectWeb.data_compra;
      compra._fsm.state = datosObjectWeb.current_status;
      compra.history = datosObjectWeb.history;
      comprasDB.push(compra);
    }

  });
}

monitor.serverIO.listen(6000, function () {
  console.log('Servidor MONITOR-IO de compras escuchando en localhost:6000..')
})