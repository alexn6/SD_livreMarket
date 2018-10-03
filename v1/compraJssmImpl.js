var amqp = require('amqplib/callback_api');
var amqp_url = require('./properties.json').amqp.url;

var _ = require("underscore");
var StateMachineHistory = require('javascript-state-machine/lib/history')

var ComprasJssm = require('javascript-state-machine').factory({
  init: 'productoSeleccionado',
  transitions: [
    {name:'generarNuevaCompra',       from:'productoSeleccionado',                            to:'compraGenerada'},
    {name:'solicitarEntrega',         from:['compraGenerada','detectandoPublicaciones',
                                            'reservandoProducto'],                            to:'seleccionandoEntrega'},
    {name:'detectarPublicaciones',     from:['compraGenerada','seleccionandoEntrega',
                                            'reservandoProducto'],                            to:'detectandoPublicaciones'},
    {name:'reservarProducto',         from:['compraGenerada','seleccionandoEntrega',
                                            'detectandoPublicaciones'],                        to:'reservandoProducto'},
    {name:'informarEntregaSeleccionada',from:['seleccionandoEntrega','detectandoPublicaciones',
                          'reservandoProducto','compraSinpublicacion','compraConpublicacion'],  to:'entregaSeleccionada'},
    {name:'informarpublicacion',       from:'*',                                               to: function (data) {return toTransitionpublicacion(data)}},
    {name:'calcularCosto',            from:'entregaSeleccionada',                             to:'calculandoCosto'},
    {name:'informarCostoCalculado',   from:['calculandoCosto','entregaSeleccionada',
                                            'compraConfirmada'],                              to:'costoCalculado'},
    {name:'seleccionarPago',          from:['entregaSeleccionada','costoCalculado'],          to:'seleccionandoPago'},
    {name:'informarPagoSeleccionado', from:'seleccionandoPago',                               to:'pagoSeleccionado'},
    {name:'confirmarCompra',          from:'*',                                               to:'compraConfirmada'},
    {name:'cancelarCompra',           from:['compraConpublicacion','pagoRechazado'],           to:'cancelandoCompra'},
    {name:'informarCompraCancelada',  from:'cancelandoCompra',                                to:'compraCancelada'},
    {name:'autorizarPago',            from:'compraConfirmada',                                to:'autorizandoPago'},
    {name:'informarAutorizacionPago', from:'autorizandoPago',                                 to: function (data) {return toTransitionPago(data)}},
    {name:'agendarEnvio',             from:'pagoAutorizado',                                  to:'agendandoEnvio'},
    {name:'finalizarCompra',          from:['pagoAutorizado','agendandoEnvio'],               to:'compraFinalizada'}
  ],

  data: {
    compra: new Object(),
    stepsQ: new Array()
  },

  plugins: [
      new StateMachineHistory()     //  <-- plugin enabled here
  ],

  methods: {

    onTransition: function (lifeCycle,data) {
      // console.log('onTransition transition: ',lifeCycle.transition);
      // console.log('onTransition from: ',lifeCycle.from);
      // console.log('onTransition to: ',lifeCycle.to);
      // console.log('onTransition data: ',data);
      console.log('onTransition history: ',this.history);
    },

    // onEnterState: function (lifeCycle,data) {
    //   console.log('onEnterState transition: ',lifeCycle.transition);
    //   console.log('onEnterState from: ',lifeCycle.from);
    //   console.log('onEnterState to: ',lifeCycle.to);
    //   console.log('onEnterState data: ',data);
    //   console.log('onEnterState history: ',this.history);
    // },

    onGenerarNuevaCompra: function (lifeCycle,data) {
      this.compra.compraId = _.pick(data,'compraId').compraId;
      this.compra.producto = _.pick(data,'producto').producto;
      this.compra.cliente = _.pick(data,'cliente').cliente;
      console.log('onGenerarNuevaCompra: con data: ',this.compra);

      // generar nueva compra despacha nuevos actividades en la mismas máquina de estados
      return ['solicitarEntrega','detectarPublicaciones','reservarProducto'];
    },

    onSolicitarEntrega: function (lifeCycle) {
      var msg =  {};
      msg.data = this.compra;
      msg.tarea = lifeCycle.transition;
      //console.log('onSolicitarEntrega: con msg: ',msg);
      publicar('web',JSON.stringify(msg));
      return;
    },

    onDetectarPublicaciones: function (lifeCycle) {
      var msg =  {};
      msg.data = this.compra;
      msg.tarea = lifeCycle.transition;
      publicar('Publicaciones',JSON.stringify(msg));
      return;
    },

    onReservarProducto: function (lifeCycle) {
      var msg =  {};
      msg.data = this.compra;
      msg.tarea = lifeCycle.transition;
      publicar('publicaciones',JSON.stringify(msg));
      return;
    },

    onInformarEntregaSeleccionada: function (lifeCycle,data) {
      this.compra.formaEntrega = _.pick(data,'formaEntrega').formaEntrega;
      if (this.compra.formaEntrega == 'correo'){
        return ['calcularCosto'];
      } else {
        return ['informarCostoCalculado'];
      }
    },

    onCalcularCosto: function (lifeCycle) {
      var msg =  {};
      msg.data = this.compra;
      msg.tarea = lifeCycle.transition;
      publicar('envios',JSON.stringify(msg));
      return;
    },

    onInformarCostoCalculado: function (lifeCycle,data) {
      this.compra.costo = _.pick(data,'costo').costo;
      return ['seleccionarPago'];
    },

    onSeleccionarPago: function (lifeCycle) {
      var msg =  {};
      msg.data = this.compra;
      msg.tarea = lifeCycle.transition;
      publicar('web',JSON.stringify(msg));
      return false;
    },

    onInformarPagoSeleccionado: function (lifeCycle,data) {
      this.compra.medioDePago = _.pick(data,'medioDePago').medioDePago;
      return ['confirmarCompra'];
    },

    onInformarpublicacion: function (lifeCycle,data) {
      this.compra.haspublicacion = _.pick(data,'haspublicacion').haspublicacion;
      if (this.compra.haspublicacion) {
        return ['cancelarCompra'];
      } else {
        return ['confirmarCompra'];
      }
      return false;
    },

    onCompraConpublicacion: function (lifeCycle,data) {
      // si el estado (dinámico) es que es compra con publicacion, cancela la compra
      this.compra.motivo = 'tuvo Publicaciones';
    },

    onConfirmarCompra: function (lifeCycle,data) {
      // sincronizar mensaje de respuesta de Publicaciones y pago seleccionado
      if (_.contains(this.history,'pagoSeleccionado') && _.contains(this.history,'compraSinpublicacion')) {
        // ya pasó por los estados de pago seleccionado e publicacion resuelta ok. prosigo con la máquina
        return ['autorizarPago'];
      } else {
        // no hay sincro, espera próxima invocación
        return false;
      }
    },

    onCancelarCompra: function (lifeCycle,data) {
      var msg =  {};
      msg.data = this.compra;
      msg.tarea = lifeCycle.transition;
      publicar('web',JSON.stringify(msg));
      return false;
    },

    onAutorizarPago: function (lifeCycle,data) {
      var msg =  {};
      msg.data = this.compra;
      msg.tarea = lifeCycle.transition;
      publicar('pagos',JSON.stringify(msg));
      return false;
    },

    onInformarAutorizacionPago: function (lifeCycle,data) {
      this.compra.pagoAutorizado = _.pick(data,'pagoAutorizado').pagoAutorizado;
      return;
    },

    onPagoRechazado: function (lifeCycle,data) {
      // el estado de pago e srechazado, se cancela l acompra
      this.compra.motivo = 'pago rechazado';
      return ['cancelarCompra'];
    },

    onPagoAutorizado: function (lifeCycle,data) {
      // el pago fue autorizado, se continúa con el paso normal
      return ['agendarEnvio'];
    },

    onAgendarEnvio: function (lifeCycle,data) {
      var msg =  {};
      msg.data = this.compra;
      msg.tarea = lifeCycle.transition;
      publicar('envios',JSON.stringify(msg));
      return ['finalizarCompra'];
    }

  }

});

// helper para publicar un mensaje en el exchange de rabbitmq
function publicar(topico,mensaje) {
  console.log('compraJssmImpl: emite mensaje: ',mensaje,' con tópico: ',topico);
  amqp.connect(amqp_url, function(err, conn) {
    conn.createChannel(function(err, ch) {
      var ex = 'livre_market';
      ch.assertExchange(ex, 'topic', {durable: true});
      ch.publish(ex,topico, new Buffer(mensaje));
      console.log(" [x] Sent %s: '%s'", topico, mensaje);
    });
  });
};

// helper para determinar transición condicional de infracción
function toTransitionpublicacion(data) {
  if (_.pick(data,'haspublicacion').haspublicacion) {
    return 'compraConpublicacion';
  } else {
    return 'compraSinpublicacion';
  }
};

// helper para determinar transición condicional de pago rechazado
function toTransitionPago(data) {
  if (!_.pick(data,'pagoAutorizado').pagoAutorizado) {
    return 'pagoRechazado';
  } else {
    return 'pagoAutorizado';
  }
};

module.exports= ComprasJssm;
