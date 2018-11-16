const express = require('express');
var _ = require('underscore');

// #####################################################
// ####################### SREVER ######################

var appMonitor = express();
var serverIO = require('http').Server(appMonitor);
var ioServerMonitor = require('socket.io')(serverIO);

// #####################################################
// #####################################################

var MonitorServerSocketJson = function (steper,comprasDB, status) {
  this.steper = steper;
  this.comprasDB = comprasDB;
  this.serverIO = serverIO;
  this.ioServerMonitor = ioServerMonitor;
  this.status = status;

  ioServerMonitor.on('connection', function (sock) {
    console.log('Nueva Conexión IO');

    // ##################################################################
    // ###################### EVENTO ALL_COMPRAS ########################

    sock.on('getAllCompras',function () {
        console.log('monitor socketJson --> se recibio el mje STATUS');

        var dataResponse;
        
        if (comprasDB.length > 0) {
          dataResponse = "";
          for (compra of comprasDB) {
            dataResponse += '**** Compra --> ' + compra.compra.compraId + ' ****\n';
            dataResponse += 'Comandos pendientes --> ' + compra.stepsQ.toString() + '\n';
            dataResponse += '*******************************************************\n';
            dataResponse += '\n';
          }
        }
        else {
          dataResponse = 'No existe ninguna compra aún';
        }
        // respuesta ante el pedido
        ioServerMonitor.sockets.emit('resp-mje-getAllCompras', dataResponse);
    });

    // ##################################################################

    // ##################################################################
    // ########################## EVENTO STEP ###########################

    sock.on('step',function (data) {
      var idCompra = data;
      var dataResponse = {
        id: idCompra,
        accion: null,
        tarea: null,
      };
      // recupera la compra en cuestión
      var compra = _.find(comprasDB,function (compra) {
        // console.log("[MON-IO] Busca en la DB la compra n° "+idCompra);
        // console.log(comprasDB);

        // ############################################
        // ################## ERROR? ##################
        return compra.compra.compraId == idCompra;
      });

      // vamos a ejecutar una transicion manualmente
      if (compra) {
        var dataEjecucion = getDatosTransicionEjecutada(compra);
        
        dataResponse.accion = 'EJECUCION';
        dataResponse.tarea = dataEjecucion.transicion;

        steper.emit('manualStep',compra);
      }
      else {
        dataResponse = 'No se encontró la compra: ' + idCompra;
      }
      // respuesta del evento
      ioServerMonitor.sockets.emit('resp-mje-step', dataResponse);
      // actualizamos las tareas
      var tareas_pend = compra.stepsQ;
      ioServerMonitor.sockets.emit('update-tareas-pend', tareas_pend);
      
      if (compra) {
        var mjesEnviados = getMjesEnviados(compra);
        console.log("[MON_SRV-step]: Mensajes enviados");
        console.log(mjesEnviados);
        // envia los mjes enviados al distMon si hay mjes
        if(mjesEnviados.length > 0){
          ioServerMonitor.sockets.emit('resp-mje-env-step', mjesEnviados);
        }
      }
    });

    // ##################################################################
    // ########################## EVENTO STATUS #########################

    sock.on('srv-status',function () {
      // notificamos al cliente correspondiente del disMonitor el estado del servidor
      // console.log('[STATUS_MON]: '+status);
      // si le responde es xq esta activo
      ioServerMonitor.sockets.emit('resp-srv-status', 'ACTIVO');
    });

    // ##################################################################

    sock.on('end',function () {
      console.log('Fin del socket: ' + sock.remoteAddress + ' ' + sock.remotePort);
    });

    sock.once('close',function (data) {
      console.log('Socket Cerrado: ' + sock.remoteAddress +' '+ sock.remotePort);
    });

  });

}

// ###############################################################
// ##################### funciones privadas ####################

  function getDatosTransicionEjecutada(jssmObject){
    var datosEjecucion = {
      transicion : null,
      datos: null
    }
    // recuperamos la 1ra transicion pendiente y sus datos
    var trans = jssmObject.stepsQ[0];
    var datos = jssmObject.dataStepQ[trans];

    datosEjecucion.transicion = trans;
    datosEjecucion.datos = datos;

    return datosEjecucion;
  }

  function getMjesEnviados(jssmObject){
    var cantMjes = jssmObject.mjesEnviados.length;
    var mje;
    var mjesEnviados = new Array();

    for (let i = 0; i < cantMjes; i++) {
      mje = jssmObject.mjesEnviados.pop();;
      mjesEnviados.push(mje);
    }

    return mjesEnviados;
  }

module.exports = MonitorServerSocketJson;
