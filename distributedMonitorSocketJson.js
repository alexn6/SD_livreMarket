var _ = require('underscore');
const ioSock = require('socket.io-client');
var portCompras = require('./properties.json').ports.compras;
var portWeb = require('./properties.json').ports.web;
var portPublicaciones = require('./properties.json').ports.publicaciones;
var portInfracciones = require('./properties.json').ports.infracciones;
var portPagos = require('./properties.json').ports.pagos;
var portEnvios = require('./properties.json').ports.envios;

// ############################################################
// ############### parche para crear compra ###################
var SenderMjes = require('./sendMje');
var factoryMjes = new SenderMjes();

// ############################################################
// ############### parche para controlar serv ###################
var AdminServer = require('./simulador/adminServers');
var adminServer = new AdminServer();

// ###############################################################
// ############### CONEXION CON LOS SERVIDORES ###################

var webIO = ioSock.connect('http://localhost:'+portWeb, {reconnect: true});
webIO.on('connect', function (sock) {
  console.log('[SRV_WEB]: Conexion exitosa!!!');
});
webIO.on('disconnect', function(){
  // mandar la señal de servidor caido al server PUG
  io.sockets.emit('srv-web-status', "INACTIVO");
});

var comprasIO = ioSock.connect('http://localhost:'+portCompras, {reconnect: true});
comprasIO.on('connect', function (sock) {
  console.log('[SRV_COMPRAS]: Conexion exitosa!!!');
});
comprasIO.on('disconnect', function(){
  // mandar la señal de servidor caido al server PUG
  io.sockets.emit('srv-compras-status', "INACTIVO");
});

var publicacionesIO = ioSock.connect('http://localhost:'+portPublicaciones, {reconnect: true});
publicacionesIO.on('connect', function (sock) {
  console.log('[SRV_PUBLICACIONES]: Conexion exitosa!!!');
});
publicacionesIO.on('disconnect', function(){
  // mandar la señal de servidor caido al server PUG
  io.sockets.emit('srv-pub-status', "INACTIVO");
});

var infraccionesIO = ioSock.connect('http://localhost:'+portInfracciones, {reconnect: true});
infraccionesIO.on('connect', function (sock) {
  console.log('[SRV_INFRACCIONES]: Conexion exitosa!!!');
});
infraccionesIO.on('disconnect', function(){
  // mandar la señal de servidor caido al server PUG
  io.sockets.emit('srv-infrac-status', "INACTIVO");
});

var pagosIO = ioSock.connect('http://localhost:'+portPagos, {reconnect: true});
pagosIO.on('connect', function (sock) {
  console.log('[SRV_PAGOS]: Conexion exitosa!!!');
});
pagosIO.on('disconnect', function(){
  // mandar la señal de servidor caido al server PUG
  io.sockets.emit('srv-pagos-status', "INACTIVO");
});

var enviosIO = ioSock.connect('http://localhost:'+portEnvios, {reconnect: true});
enviosIO.on('connect', function (sock) {
  console.log('[SRV_ENVIOS]: Conexion exitosa!!!');
});
enviosIO.on('disconnect', function(){
  // mandar la señal de servidor caido al server PUG
  io.sockets.emit('srv-envios-status', "INACTIVO");
});

// ###############################################################

var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);

const port = 5557

server.listen(port, function() {
  console.log("Servidor corriendo en http://localhost:"+port);
});

app.use(express.static('public'));

// #################################################################
// ##################### Escuchando Server PUG #####################
// #################################################################

io.on('connection', function(socket) {
  console.log('[SERVER_PUG]: conexion exitosa!!!');

  // mje de estado del servidor
  socket.on('mje-status', function(from, msg) {
    console.log("Se toma el mje <mje-status> del SERVER-PUG");

    var cliente = resolverCliente(from);

    // mandamos el estado correspodiente
    if (cliente != null) {
      console.log("[mje-status]: Mje enviado al monitor-io desde el disMonSocJson");
      cliente.emit('getAllCompras');
    }
    else{
      io.sockets.emit('resp-mje-status','Servidor desconocido:'+from+'\n');
    }

  });

  // mje de siguiente paso
  socket.on('next-step', function(from, idCompra){
    console.log("Se recibio el mje <next-step> del SERVER-PUG");
    var cliente = resolverCliente(from);
    // mandamos el estado correspodiente
    if (cliente != null) {
      console.log("[next-step]: Mje enviado al monitor-io desde el disMonSocJson");
      // enviamos el mje al cliente
      cliente.emit('step', idCompra);
    }
    else{
      io.sockets.emit('resp-next-step','Servidor desconocido:'+from+'\n');
    }
  });

  // estado de todos los servidores
  socket.on('all-status', function(){
    console.log("[DIST_MON]: Se recibio el mje <all-status> del SERVER-PUG");
    
    // pedimos el estado de todos los servidores
    for (cli of [comprasIO, webIO, publicacionesIO, pagosIO, infraccionesIO, enviosIO]) {
      console.log("[DIST_MON]: Se pide <srv-status> al MonSrv");
      cli.emit('srv-status');
    }

  });

  // se encarga de crear una compra desde cualquiera de los servidores
  socket.on('create-compra', function(data) {
    console.log("[DIST_MON]: Se recibio el mje <create-compra> del SERVER-PUG");
    // manda el mjes a la cola de compras para crear una compra nueva
    factoryMjes.create();
  });

  // inicia el servidor especificado
  socket.on('start-server', function(server, modo) {
    console.log("[start-server]: Se toma el mje del SERVER-PUG");

    adminServer.initServer(server, modo);
    
    //io.sockets.emit('resp-start-server', server, modo);
    
  });

  // detiene el servidor especificado
  socket.on('stop-server', function(server) {
    console.log("[stop-server]: Se toma el mje del SERVER-PUG");

    adminServer.stopServer(server);
    
    //io.sockets.emit('resp-start-server', server, modo);
    
  });

  // socket.on('end',function () {
  //   console.log('Fin del socket: ' + socket.remoteAddress + ' ' + socket.remotePort);
  // });

  // socket.once('close',function (data) {
  //   console.log('Socket Cerrado: ' + socket.remoteAddress +' '+ socket.remotePort);
  // });

  // compras.on('data',function (data) {
  //   console.log("compras : "+data);
  //   // socket.sendMessage({result: mUtil.to_ObjJSON(data)});
  //   io.sockets.emit('messages', [mUtil.to_ObjJSON(data)]);
  // });

  // compras.on('close',function () {
  //   console.log('conexxion con compras perdida...');
  //   // socket.sendMessage({result: data});
  // });

  // Publicaciones.on('data',function (data) {
  //   console.log("publicaciones : "+data);
  //   socket.sendMessage({result: data});
  // });

  // Publicaciones.on('close',function () {
  //   console.log('conexión con Publicaciones perdida...');
  //   // socket.sendMessage({result: data});
  // });

  // web.on('data',function (data) {
  //   console.log("web : "+data);
  //   socket.sendMessage({result: data});
  // });

  // web.on('close',function () {
  //   console.log('conexión con web perdida...');
  //   // socket.sendMessage({result: data});
  // });

});

// #################################################################

// #################################################################
// ###################### Escuchando Monitores #####################
// #################################################################

// ##############################################
// ############## MON-COMPRAS ###################

// 
comprasIO.on('resp-mje-getAllCompras', function(data) {
  console.log("[resp-mje-getAllCompras]: Mje recibido del Monitor-IO (COMPRAS): ",data);
  // se envia la info al server PUG
  io.sockets.emit('resp-mje-status', data);
})
comprasIO.on('detalle-mje-getAllCompras', function(data) {
  console.log("[detalle-mje-getAllCompras]: Mje recibido del Monitor-IO (COMPRAS): ",data);
  // se envia la info al server PUG
  io.sockets.emit('resp-mje-status-detalle', data);
})

// respuesta del sig paso
comprasIO.on('resp-mje-step', function(data) {
  console.log("[resp-mje-step]: Mje recibido del Monitor-IO (COMPRAS): ",data);
  // se envia la info al server PUG
  io.sockets.emit('resp-next-step', data);
})

// escuchamos la resp del Monitor-IO
comprasIO.on('resp-mje-env-step', function(data) {
  console.log("[resp-mje-env-step]: Mje recibido del Monitor-IO (COMPRAS): ",data);
  // se envia la info al server PUG
  io.sockets.emit('resp-env-step', data);
})

// escuchamos la resp del Monitor-IO del estado del servidor
comprasIO.on('resp-srv-status', function(data) {
  console.log("[resp-srv-status]: Mje recibido del Monitor-IO (COMPRAS): ",data);
  // se envia la info al server PUG
  io.sockets.emit('srv-compras-status', data);
})

// ecuchamos acutualizaciones de tareas pendientes
comprasIO.on('update-tareas-pend', function(data) {
  console.log("[update-tareas-pend]: Mje recibido del Monitor-IO (COMPRAS): ",data);
  // se envia la info al server PUG
  io.sockets.emit('tareas_pend_comp', data);
})

// ecuchamos la creacion de nuevas compras
comprasIO.on('update-cant-compras', function(data) {
  console.log("[update-cant-compras]: Mje recibido del Monitor-IO (COMPRAS): ",data);
  // se envia la info al server PUG
  io.sockets.emit('upd_compras', data);
})

// ##############################################
// ################## MON-WEB ###################

// escuchamos la resp del Monitor-IO del estado del servidor
webIO.on('resp-srv-status', function(data) {
  console.log("[resp-srv-status]: Mje recibido del Monitor-IO (WEB): ",data);
  // se envia la info al server PUG
  io.sockets.emit('srv-web-status', data);
})

// escuchamos cuando ingresa una tarea
webIO.on('mon-ingreso-tarea', function(data) {
  console.log("[mon-ingreso-tarea]: Mje recibido del Monitor-IO (WEB): ",data);
  // se envia la info al server PUG
  io.sockets.emit('tarea-ing-web', data);
})

// ecuchamos acutualizaciones de tareas pendientes
webIO.on('update-tareas-pend', function(data) {
  console.log("[update-tareas-pend]: Mje recibido del Monitor-IO (WEB): ",data);
  // se envia la info al server PUG
  io.sockets.emit('tareas-pend-web', data);
})

// respuesta del sig paso
webIO.on('resp-mje-step', function(data) {
  console.log("[resp-mje-step]: Mje recibido del Monitor-IO (WEB): ",data);
  // se envia la info al server PUG
  io.sockets.emit('resp-next-step-web', data);
})

// escuchamos la resp del Monitor-IO de los mjes enviados
webIO.on('resp-mje-env-step', function(data) {
  console.log("[resp-mje-env-step]: Mje recibido del Monitor-IO (WEB): ",data);
  // se envia la info al server PUG
  io.sockets.emit('resp-mjes-env-web', data);
})

// ##############################################
// ############# MON-PUBLICACIONES ##############

// escuchamos la resp del Monitor-IO del estado del servidor
publicacionesIO.on('resp-srv-status', function(data) {
  console.log("[resp-srv-status]: Mje recibido del Monitor-IO (PUBLICACIONES): ",data);
  // se envia la info al server PUG
  io.sockets.emit('srv-pub-status', data);
})

// escuchamos cuando ingresa una tarea
publicacionesIO.on('mon-ingreso-tarea', function(data) {
  console.log("[mon-ingreso-tarea]: Mje recibido del Monitor-IO (PUBLICACIONES): ",data);
  // se envia la info al server PUG
  io.sockets.emit('tarea-ing-pub', data);
})

// ecuchamos acutualizaciones de tareas pendientes
publicacionesIO.on('update-tareas-pend', function(data) {
  console.log("[update-tareas-pend]: Mje recibido del Monitor-IO (PUBLICACIONES): ",data);
  // se envia la info al server PUG
  io.sockets.emit('tareas-pend-pub', data);
})

// respuesta del sig paso
publicacionesIO.on('resp-mje-step', function(data) {
  console.log("[resp-mje-step]: Mje recibido del Monitor-IO (PUBLICACIONES): ",data);
  // se envia la info al server PUG
  io.sockets.emit('resp-next-step-pub', data);
})

// escuchamos la resp del Monitor-IO de los mjes enviados
publicacionesIO.on('resp-mje-env-step', function(data) {
  console.log("[resp-mje-env-step]: Mje recibido del Monitor-IO (PUBLICACIONES): ",data);
  // se envia la info al server PUG
  io.sockets.emit('resp-mjes-env-pub', data);
})

// ##############################################
// ################# MON-PAGOS ##################

// escuchamos la resp del Monitor-IO del estado del servidor
pagosIO.on('resp-srv-status', function(data) {
  console.log("[resp-srv-status]: Mje recibido del Monitor-IO (PAGOS): ",data);
  // se envia la info al server PUG
  io.sockets.emit('srv-pagos-status', data);
})

// escuchamos cuando ingresa una tarea
pagosIO.on('mon-ingreso-tarea', function(data) {
  console.log("[mon-ingreso-tarea]: Mje recibido del Monitor-IO (PAGOS): ",data);
  // se envia la info al server PUG
  io.sockets.emit('tarea-ing-pagos', data);
})

// ecuchamos acutualizaciones de tareas pendientes
pagosIO.on('update-tareas-pend', function(data) {
  console.log("[update-tareas-pend]: Mje recibido del Monitor-IO (PAGOS): ",data);
  // se envia la info al server PUG
  io.sockets.emit('tareas-pend-pagos', data);
})

// respuesta del sig paso
pagosIO.on('resp-mje-step', function(data) {
  console.log("[resp-mje-step]: Mje recibido del Monitor-IO (PAGOS): ",data);
  // se envia la info al server PUG
  io.sockets.emit('resp-next-step-pagos', data);
})

// escuchamos la resp del Monitor-IO de los mjes enviados
pagosIO.on('resp-mje-env-step', function(data) {
  console.log("[resp-mje-env-step]: Mje recibido del Monitor-IO (PAGOS): ",data);
  // se envia la info al server PUG
  io.sockets.emit('resp-mjes-env-pagos', data);
})

// ##############################################
// ############# MON-INFRACCIONES ###############

// escuchamos la resp del Monitor-IO del estado del servidor
infraccionesIO.on('resp-srv-status', function(data) {
  console.log("[resp-srv-status]: Mje recibido del Monitor-IO (INFRACCIONES): ",data);
  // se envia la info al server PUG
  io.sockets.emit('srv-infrac-status', data);
})

// escuchamos cuando ingresa una tarea
infraccionesIO.on('mon-ingreso-tarea', function(data) {
  console.log("[mon-ingreso-tarea]: Mje recibido del Monitor-IO (INFRACCIONES): ",data);
  // se envia la info al server PUG
  io.sockets.emit('tarea-ing-infrac', data);
})

// ecuchamos acutualizaciones de tareas pendientes
infraccionesIO.on('update-tareas-pend', function(data) {
  console.log("[update-tareas-pend]: Mje recibido del Monitor-IO (INFRACCIONES): ",data);
  // se envia la info al server PUG
  io.sockets.emit('tareas-pend-infrac', data);
})

// respuesta del sig paso
infraccionesIO.on('resp-mje-step', function(data) {
  console.log("[resp-mje-step]: Mje recibido del Monitor-IO (INFRACCIONES): ",data);
  // se envia la info al server PUG
  io.sockets.emit('resp-next-step-infrac', data);
})

// escuchamos la resp del Monitor-IO de los mjes enviados
infraccionesIO.on('resp-mje-env-step', function(data) {
  console.log("[resp-mje-env-step]: Mje recibido del Monitor-IO (INFRACCIONES): ",data);
  // se envia la info al server PUG
  io.sockets.emit('resp-mjes-env-infrac', data);
})

// ##############################################
// ################# MON-ENVIOS #################

// escuchamos la resp del Monitor-IO del estado del servidor
enviosIO.on('resp-srv-status', function(data) {
  console.log("[resp-srv-status]: Mje recibido del Monitor-IO (ENVIOS): ",data);
  // se envia la info al server PUG
  io.sockets.emit('srv-envios-status', data);
})

// escuchamos cuando ingresa una tarea
enviosIO.on('mon-ingreso-tarea', function(data) {
  console.log("[mon-ingreso-tarea]: Mje recibido del Monitor-IO (ENVIOS): ",data);
  // se envia la info al server PUG
  io.sockets.emit('tarea-ing-envios', data);
})

// ecuchamos acutualizaciones de tareas pendientes
enviosIO.on('update-tareas-pend', function(data) {
  console.log("[update-tareas-pend]: Mje recibido del Monitor-IO (ENVIOS): ",data);
  // se envia la info al server PUG
  io.sockets.emit('tareas-pend-envios', data);
})

// respuesta del sig paso
enviosIO.on('resp-mje-step', function(data) {
  console.log("[resp-mje-step]: Mje recibido del Monitor-IO (ENVIOS): ",data);
  // se envia la info al server PUG
  io.sockets.emit('resp-next-step-envios', data);
})

// escuchamos la resp del Monitor-IO de los mjes enviados
enviosIO.on('resp-mje-env-step', function(data) {
  console.log("[resp-mje-env-step]: Mje recibido del Monitor-IO (ENVIOS): ",data);
  // se envia la info al server PUG
  io.sockets.emit('resp-mjes-env-envios', data);
})

// ####################################################
// ################ Funciones privadas ################

function resolverCliente(server){
  // console.log("Se va a resolver cliente: "+server);
  var cliente = null;
  switch (server) {
    case 'compras':
      cliente = compras;
      break;
    case 'compras-io':
      cliente = comprasIO;
      break;
    case 'publicaciones':
      cliente = publicacionesIO;
      break;
    case 'web':
      cliente = webIO;
      break;
    case 'infracciones':
      cliente = infraccionesIO;
      break;
    case 'pagos':
      cliente = pagosIO;
      break;
    case 'envios':
      cliente = enviosIO;
      break;
    default:
      console.log("Servidor desconocido");
      break;
  }

  return cliente;
}