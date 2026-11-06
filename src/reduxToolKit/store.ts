import { configureStore, combineReducers } from "@reduxjs/toolkit";
import userReducer from "./user/userSlice";
import setUpReducer from "./setUp/setUpSlice";
import teacherReducer from "./teacher/teacherSlice";
import adminReducer from "./admin/adminSlice";
import studentReducer from "./student/studentSlice";
import superAdminReducer from "./superAdmin/superAdminSlice";
import lessonGeneratorReducer from "./lessonGenerator/lessonGeneratorSlice";
import sabiStandaloneAuthReducer from "./sabiStandaloneAuth/sabiStandaloneAuthSlice";
import { paraApi } from "./api";
import { uniApi } from "./api/uniBaseApi";
import { superAdminApi } from "./api/superAdminBaseApi";
import { cbtMicroserviceApi } from "@cbt/store/cbtMicroserviceApi";
import { RESET_STORE } from "./constants";

const appReducer = combineReducers({
  user: userReducer,
  setUp: setUpReducer,
  teacher: teacherReducer,
  admin: adminReducer,
  student: studentReducer,
  superAdmin: superAdminReducer,
  lessonGenerator: lessonGeneratorReducer,
  sabiStandaloneAuth: sabiStandaloneAuthReducer,
  [paraApi.reducerPath]: paraApi.reducer,
  [uniApi.reducerPath]: uniApi.reducer,
  [superAdminApi.reducerPath]: superAdminApi.reducer,
  [cbtMicroserviceApi.reducerPath]: cbtMicroserviceApi.reducer,
});

// Passing undefined to each slice reducer causes it to return its initialState,
// which clears all in-memory data (classes, sessions, assessments, etc.).
// RTK Query reducers also reset to an empty cache when given undefined.
const rootReducer = (
  state: ReturnType<typeof appReducer> | undefined,
  action: { type: string },
) => {
  if (action.type === RESET_STORE) {
    return appReducer(undefined, action);
  }
  return appReducer(state, action);
};

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(
      paraApi.middleware,
      uniApi.middleware,
      superAdminApi.middleware,
      cbtMicroserviceApi.middleware,
    ),
});

export type RootState = ReturnType<typeof appReducer>;
export type AppDispatch = typeof store.dispatch;
