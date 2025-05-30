import AppLayout from './AppLayout.vue';
import BaseButton from './BaseButton.vue';
import BaseCard from './BaseCard.vue';
import BaseInput from './BaseInput.vue';
import BaseModal from './BaseModal.vue';
import BaseSelect from './BaseSelect.vue';
import ComponentShowcase from './ComponentShowcase.vue';
import Confirmation from './Confirmation.vue';
import DataTable from './DataTable.vue';
import Forbidden from './Forbidden.vue';
import LoadingSpinner from './LoadingSpinner.vue';
import NotFound from './NotFound.vue';
import ToastNotification from './ToastNotification.vue';

export {
  AppLayout,
  BaseButton,
  BaseCard,
  BaseInput,
  BaseModal,
  BaseSelect,
  ComponentShowcase,
  Confirmation,
  DataTable,
  Forbidden,
  LoadingSpinner,
  NotFound,
  ToastNotification
};

// For global registration
export default {
  install(app: any) {    app.component('AppLayout', AppLayout);
    app.component('BaseButton', BaseButton);
    app.component('BaseCard', BaseCard);
    app.component('BaseInput', BaseInput);
    app.component('BaseModal', BaseModal);
    app.component('BaseSelect', BaseSelect);
    app.component('ComponentShowcase', ComponentShowcase);
    app.component('Confirmation', Confirmation);
    app.component('DataTable', DataTable);
    app.component('Forbidden', Forbidden);
    app.component('LoadingSpinner', LoadingSpinner);
    app.component('NotFound', NotFound);
    app.component('ToastNotification', ToastNotification);
  }
};
