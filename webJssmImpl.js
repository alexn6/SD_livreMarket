var amqp = require('amqplib/callback_api');
var amqp_url = require('./properties.json').amqp.url;

var _ = require("underscore");
var StateMachineHistory = require('javascript-state-machine/lib/history')

var WebJssm = require('javascript-state-machine').factory({
  init: 'compraGenerada',
  transitions: [
    {name:'solicitarEntrega',         from:'*',                                               to:'resolviendoEntrega'},
    {name:'resolverEntrega',          from:'resolviendoEntrega',                              to:'informandoEntrega'},
    {name:'informarEntregaSeleccionada',from:'informandoEntrega',                             to:'entregaInformada'},
    {name:'reintentarEntrega',        from:'entregaInformada',                                to:'entregaInformada'}
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

    onSolicitarEntrega: function (lifeCycle,data) {
      //console.log('onDetectarPublicaciones: data --> ',data);
      this.compra = data;
      return ['resolverEntrega'];
    },

    onResolverEntrega: function (lifeCycle,data) {
      //console.log('onResolverpublicacion: data --> ',data);
      this.compra.formaEntrega = Math.random() > 0.5 ? 'retira' : 'correo';
      return ['informarEntregaSeleccionada'];
    },

    onInformarEntregaSeleccionada: function (lifeCycle,data) {
      var msg =  {};
      msg.data = this.compra;
      msg.tarea = lifeCycle.transition;
      publicar('compras',JSON.stringify(msg));
      return false;
    },

    onReintentarEntrega: function (lifeCycle,data) {
      // Se solicitó re-informar la entrega seleccionada con lo cual se re-emite el estado
      return ['informarEntregaSeleccionada'];
    }

  }

});

// helper para publicar un mensaje en el exchange de rabbitmq
function publicar(topico,mensaje) {
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
function topublicacionResuelta(data) {
  if (_.pick(data,'haspublicacion').haspublicacion) {
    return 'compraConpublicacion';
  } else {
    return 'compraSinpublicacion';
  }
};

module.exports= WebJssm;