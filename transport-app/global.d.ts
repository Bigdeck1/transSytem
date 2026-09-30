export {};

declare global {
  interface Window {
    api: {
      // Auth
      login: (email: string, password: string) => Promise<any>;
      register: (data: any) => Promise<any>;

      // Employees
      getEmployees: () => Promise<any[]>;
      getEmployeeById: (id: string) => Promise<any>;
      addEmployee: (data: any) => Promise<any>;
      updateEmployee: (id: string, data: any) => Promise<any>;
      deleteEmployee: (id: string) => Promise<any>;
      createEmployee: (payload: {
        employee_id: string;
        full_name: string;
        email?: string;
        phone?: string | null;
        status?: string;
        position?: string;
        department?: string;
        auth_email?: string;
        auth_password?: string;
      }) => Promise<any>;
      syncEmployeeAccountByEmail: (employeeId: string, email: string) => Promise<any>;
      getEmployeeByUser: (userId: string) => Promise<any>;

      // Time off
      getTimeOffRequests: () => Promise<any[]>;
      addTimeOffRequest: (data: any) => Promise<any>;
      updateTimeOffRequestStatus: (id: string, status: string) => Promise<any>;
      recalculateStatuses: () => Promise<any>;

      // Vehicles
      getVehicles: () => Promise<any[]>;
      addVehicle: (data: any) => Promise<any>;
      updateVehicle: (id: string, data: any) => Promise<any>;
      deleteVehicle: (id: string) => Promise<any>;
      setVehicleStatus: (id: number | string, status: string) => Promise<any>;

      // Trips
      getTrips: () => Promise<any[]>;
      addTrip: (data: any) => Promise<any>;
      updateTripStatus: (id: string | number, status: string) => Promise<any>;
      setDriverStatus: (driverId: string, status: string) => Promise<any>;

      // Clients
      getClients: () => Promise<any[]>;
      addClient: (data: any) => Promise<any>;
      updateClient: (id: string, data: any) => Promise<any>;
      deleteClient: (id: string) => Promise<any>;

      // Dashboard
      getDashboardStats: () => Promise<any>;
      getRecentTrips: () => Promise<any[]>;

      // Billing
      billing: {
        getAll: () => Promise<any[]>;
        create: (data: any) => Promise<any>;
        delete: (id: number) => Promise<any>;
        update: (id: number, data: any) => Promise<any>;
        getLastNumber: () => Promise<string>;
        getStats: () => Promise<any>;
      };

      // Attendance
      getAttendance: (employeeId: string) => Promise<any[]>;
      addAttendance: (data: any) => Promise<any>;
      getAllAttendance: (options?: {
        employeeId?: string;
        startDate?: string;
        endDate?: string;
      }) => Promise<any[]>;

      // Payroll
      payroll: {
        getMyMonthly: (userId: string, monthYYYYMM: string) => Promise<any>;
        getMonthlyAll: (monthYYYYMM: string) => Promise<any>;
      };

      // Realtime
      onRealtime: (cb: (evt: any, data: any) => void) => () => void;
    };
  }
}