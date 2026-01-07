import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check local storage for persisted session (optional, for now simple session)
        const storedUser = localStorage.getItem('pos_user');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }
        setLoading(false);
    }, []);

    const login = async (pin) => {
        try {
            const res = await api.login(pin);
            if (res.success) {
                setUser(res.user);
                // Persist User & Attendance ID
                localStorage.setItem('pos_user', JSON.stringify(res.user));
                if (res.attendanceId) {
                    localStorage.setItem('pos_attendance_id', res.attendanceId);
                }
                return { success: true, user: res.user };
            } else {
                return { success: false, error: res.error };
            }
        } catch (error) {
            return { success: false, error: 'Network error' };
        }
    };

    const logout = async () => {
        // Clock Out if we have an ID
        const attendanceId = localStorage.getItem('pos_attendance_id');
        if (attendanceId) {
            try {
                await api.logout(attendanceId);
            } catch (e) {
                console.error("Logout/ClockOut error:", e);
            }
            localStorage.removeItem('pos_attendance_id');
        }

        setUser(null);
        localStorage.removeItem('pos_user');
    };

    // Refresh User Data (e.g., after editing in User Management)
    const refreshUser = (updatedUserData) => {
        if (updatedUserData && user && updatedUserData.id === user.id) {
            const newUser = { ...user, ...updatedUserData };
            setUser(newUser);
            localStorage.setItem('pos_user', JSON.stringify(newUser));
        }
    };

    // Alias for refreshUser
    const updateUser = refreshUser;

    return (
        <AuthContext.Provider value={{ user, login, logout, loading, refreshUser, updateUser }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
