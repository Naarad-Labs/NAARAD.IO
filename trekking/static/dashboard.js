const emptyCredentials = () => ({ name: '', email: '', password: '' });
const emptyRoute = () => ({ name: '', location: '', difficulty: 'Easy', duration: 1, route_slug: '' });
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

const pages = {
  '/routes/departures/': 'departures',
  '/journey/bookings/': 'bookings',
  '/creators/guide/': 'guide',
  '/admin/treks/': 'admin',
  '/trekking/sign-in/': 'signin',
};
const query = new URLSearchParams(location.search);
const screen = pages[location.pathname] || 'standalone';
const requiredRole = { guide: 'staff', admin: 'admin', bookings: 'trekker' }[screen];

function continueTo(user) {
  let next;
  try {
    next = new URL(query.get('next') || '/', location.origin);
  } catch {
    next = new URL('/', location.origin);
  }
  const role = { '/creators/guide/': 'staff', '/admin/treks/': 'admin', '/journey/bookings/': 'trekker' }[next.pathname];
  if (next.origin === location.origin && next.pathname !== '/trekking/sign-in/' && (!role || role === user.role)) return next.href;
  return { admin: '/admin/treks/', staff: '/creators/guide/', trekker: '/routes/departures/' }[user.role];
}

Vue.createApp({
  data() {
    return {
      integrated: screen !== 'standalone',
      screen, requiredRole, signInRole: query.get('role'), switching: query.has('switch'),
      departure: query.get('departure'), routeSlug: query.get('route'),
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
    allowed() { return this.user && (!this.requiredRole || this.user.role === this.requiredRole); },
    roleName() { return { admin: 'Admin', staff: 'Staff', trekker: 'Trekker' }[this.user?.role]; },
    visibleBookings() { return this.user?.role === 'admin' ? this.admin.bookings : this.bookings; },
  },
  async mounted() {
    await this.perform(async () => {
      const { user } = await api('/api/me');
      this.user = user;
      this.profileName = user?.name || '';
      if (user && screen === 'signin' && !this.switching) {
        location.replace(continueTo(user));
        return;
      }
      if (this.allowed && screen !== 'signin') await this.load();
    });
    this.loading = false;
  },
  beforeUnmount() { clearTimeout(this.exportTimer); },
  methods: {
    departureDates(trek) {
      const format = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'UTC' });
      const start = new Date(trek.start_date + 'T00:00:00Z');
      const end = new Date(trek.end_date + 'T00:00:00Z');
      return format.formatRange(start, end);
    },
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
      if (screen === 'departures') {
        const filters = new URLSearchParams(this.filter);
        if (this.routeSlug) filters.set('route', this.routeSlug);
        if (this.departure) filters.set('departure', this.departure);
        treks = await api('/api/departures?' + filters);
        if (this.user.role === 'trekker') this.bookings = await api('/api/bookings');
      } else if (screen === 'bookings') {
        this.bookings = await api('/api/bookings');
        await this.refreshExport();
        treks = [];
      } else if (this.user.role === 'admin') {
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
        if (screen === 'signin') {
          if (this.signInRole && this.user.role !== this.signInRole) {
            await api('/api/logout', 'POST', {});
            this.user = null;
            throw new Error('This workspace requires a ' + this.signInRole + ' account.');
          }
          location.replace(continueTo(this.user));
          return;
        }
        await this.load();
      });
    },
    logout() {
      return this.perform(async () => {
        await api('/api/logout', 'POST', {});
        if (this.integrated) {
          location.replace('/');
          return;
        }
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
