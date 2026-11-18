const emptyCredentials = () => ({ name: '', email: '', password: '' });
const emptyRoute = () => ({ name: '', location: '', difficulty: 'Easy', duration: 1 });
const emptyTrek = () => ({ route_id: '', staff_id: null, capacity: 10, start_date: '', end_date: '', instructions: '' });

async function api(path, method = 'GET', body) {
  const options = { method };
  if (body !== undefined) {
    options.headers = { 'Content-Type': 'application/json' };
    options.body = JSON.stringify(body);
  }
  const response = await fetch('.' + path, options);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'The request failed.');
  return result;
}

Vue.createApp({
  data() {
    return {
      integrated: location.pathname === '/trekking/',
      loading: true, busy: false, message: '', error: '', user: null, registering: false,
      credentials: emptyCredentials(), profileName: '',
      admin: null, adminSearch: '', routeForm: emptyRoute(), staffForm: emptyCredentials(),
      trekForm: emptyTrek(), treks: [], bookings: [], selectedTrek: null, participants: [],
      filter: { q: '', location: '', difficulty: '', duration: '' },
      latestExport: null, exportTimer: null,
      difficulties: ['Easy', 'Moderate', 'Hard'],
      metricLabels: { treks: 'Treks', users: 'Trekkers', staff: 'Staff', bookings: 'Bookings', completed: 'Completed' },
    };
  },
  computed: {
    roleName() { return { admin: 'Admin', staff: 'Staff', trekker: 'Trekker' }[this.user?.role]; },
    visibleBookings() { return this.user?.role === 'admin' ? this.admin.bookings : this.bookings; },
  },
  async mounted() {
    await this.perform(async () => {
      const { user } = await api('/api/me');
      this.user = user;
      this.profileName = user?.name || '';
      if (user) await this.load();
    });
    this.loading = false;
  },
  beforeUnmount() { clearTimeout(this.exportTimer); },
  methods: {
    async perform(action) {
      this.busy = true;
      this.error = '';
      this.message = '';
      try {
        await action();
      } catch (error) {
        this.error = error.message;
      } finally {
        this.busy = false;
      }
    },
    async load() {
      let treks;
      if (this.user.role === 'admin') {
        this.admin = await api('/api/admin?' + new URLSearchParams({ q: this.adminSearch }));
        treks = this.admin.treks;
      } else if (this.user.role === 'staff') {
        treks = await api('/api/treks');
      } else {
        [treks, this.bookings] = await Promise.all([
          api('/api/treks?' + new URLSearchParams(this.filter)), api('/api/bookings'),
        ]);
        await this.refreshExport();
      }
      this.treks = treks.map(trek => ({
        ...trek, editStatus: trek.status, editStaff: trek.staff_id, editCapacity: trek.capacity,
      }));
    },
    authenticate() {
      return this.perform(async () => {
        if (this.registering) await api('/api/register', 'POST', this.credentials);
        this.user = await api('/api/login', 'POST', this.credentials);
        this.profileName = this.user.name;
        this.credentials = emptyCredentials();
        this.registering = false;
        await this.load();
      });
    },
    logout() {
      return this.perform(async () => {
        await api('/api/logout', 'POST', {});
        clearTimeout(this.exportTimer);
        this.user = null;
        this.admin = null;
        this.treks = [];
        this.bookings = [];
        this.selectedTrek = null;
        this.latestExport = null;
      });
    },
    change(path, method, body, message, after) {
      return this.perform(async () => {
        await api(path, method, body);
        if (after) await after();
        await this.load();
        this.message = message;
      });
    },
    editRoute(route) {
      this.routeForm = { ...route };
      Vue.nextTick(() => document.querySelector('input[required]')?.focus());
    },
    resetRoute() { this.routeForm = emptyRoute(); },
    saveRoute() {
      const id = this.routeForm.id;
      return this.change(id ? '/api/routes/' + id : '/api/routes', id ? 'PATCH' : 'POST',
        this.routeForm, 'Route saved.', this.resetRoute);
    },
    addStaff() {
      return this.change('/api/staff', 'POST', this.staffForm, 'Staff account created.',
        () => { this.staffForm = emptyCredentials(); });
    },
    scheduleTrek() {
      return this.change('/api/treks', 'POST', this.trekForm, 'Trek scheduled.',
        () => { this.trekForm = emptyTrek(); });
    },
    setAccountStatus(account, event) {
      const status = event.target.value;
      event.target.value = account.status;
      return this.change('/api/users/' + account.id, 'PATCH', { status }, 'Account updated.');
    },
    statuses(trek) {
      const options = {
        Pending: this.user.role === 'admin' ? ['Approved', 'Open', 'Closed'] : ['Open', 'Closed'],
        Approved: ['Open', 'Closed'], Open: ['Closed', 'Started'], Closed: ['Open', 'Started'],
        Started: ['Completed'], Completed: [],
      };
      return [trek.status, ...options[trek.status]];
    },
    saveTrek(trek) {
      const payload = { status: trek.editStatus, capacity: trek.editCapacity };
      if (trek.editStaff !== trek.staff_id) payload.staff_id = trek.editStaff;
      return this.change('/api/treks/' + trek.id, 'PATCH', payload, 'Trek updated.', async () => {
        if (this.selectedTrek?.id === trek.id) await this.fetchParticipants(trek);
      });
    },
    async fetchParticipants(trek) {
      this.participants = await api('/api/treks/' + trek.id + '/participants');
      this.selectedTrek = trek;
    },
    loadParticipants(trek) { return this.perform(() => this.fetchParticipants(trek)); },
    cancelBooking(person) {
      const trek = this.selectedTrek;
      return this.change('/api/treks/' + trek.id + '/participants/' + person.id, 'PATCH',
        { status: 'Cancelled' }, 'Booking cancelled.', () => this.fetchParticipants(trek));
    },
    saveProfile() {
      return this.change('/api/me', 'PATCH', { name: this.profileName }, 'Profile updated.',
        () => { this.user.name = this.profileName; });
    },
    queueExport() { return this.change('/api/exports', 'POST', {}, 'Export requested.'); },
    async refreshExport() {
      const userId = this.user.id;
      const [latest] = await api('/api/exports');
      if (this.user?.id !== userId) return;
      this.latestExport = latest || null;
      clearTimeout(this.exportTimer);
      if (latest?.status === 'Queued') {
        this.exportTimer = setTimeout(() => this.refreshExport().catch(error => {
          if (this.user?.id === userId) this.error = error.message;
        }), 1500);
      }
    },
  },
}).mount('#app');
