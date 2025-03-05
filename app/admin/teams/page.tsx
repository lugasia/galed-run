'use client';

import React, { useState } from 'react';
import type { Team } from '../../types';

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [showAddTeam, setShowAddTeam] = useState(false);
  const [newTeam, setNewTeam] = useState({
    name: '',
    members: [{ name: '', phone: '' }],
  });

  const handleAddMember = () => {
    setNewTeam({
      ...newTeam,
      members: [...newTeam.members, { name: '', phone: '' }],
    });
  };

  const handleMemberChange = (index: number, field: 'name' | 'phone', value: string) => {
    const updatedMembers = [...newTeam.members];
    updatedMembers[index] = {
      ...updatedMembers[index],
      [field]: value,
    };
    setNewTeam({
      ...newTeam,
      members: updatedMembers,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/teams', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newTeam),
      });

      if (!response.ok) {
        throw new Error('Failed to create team');
      }

      const createdTeam = await response.json();
      setTeams([...teams, createdTeam]);
      setShowAddTeam(false);
      setNewTeam({
        name: '',
        members: [{ name: '', phone: '' }],
      });
    } catch (error) {
      console.error('Error creating team:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">ניהול קבוצות</h1>
            <button
              onClick={() => setShowAddTeam(true)}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              הוספת קבוצה
            </button>
          </div>

          {showAddTeam && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-lg p-6 max-w-md w-full">
                <h2 className="text-xl font-bold mb-4">הוספת קבוצה חדשה</h2>
                <form onSubmit={handleSubmit}>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      שם הקבוצה
                    </label>
                    <input
                      type="text"
                      value={newTeam.name}
                      onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
                      className="w-full p-2 border rounded"
                      required
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      חברי קבוצה
                    </label>
                    {newTeam.members.map((member, index) => (
                      <div key={index} className="flex gap-2 mb-2">
                        <input
                          type="text"
                          placeholder="שם"
                          value={member.name}
                          onChange={(e) => handleMemberChange(index, 'name', e.target.value)}
                          className="flex-1 p-2 border rounded"
                          required
                        />
                        <input
                          type="tel"
                          placeholder="טלפון"
                          value={member.phone}
                          onChange={(e) => handleMemberChange(index, 'phone', e.target.value)}
                          className="flex-1 p-2 border rounded"
                          required
                        />
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={handleAddMember}
                      className="text-blue-500 text-sm mt-1"
                    >
                      + הוספת חבר קבוצה
                    </button>
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddTeam(false)}
                      className="px-4 py-2 text-gray-600 hover:text-gray-800"
                    >
                      ביטול
                    </button>
                    <button
                      type="submit"
                      className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                    >
                      שמירה
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4">
            {teams.map((team) => (
              <div
                key={team._id}
                className="border rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-semibold">{team.name}</h3>
                    <div className="mt-2">
                      {team.members.map((member, index) => (
                        <div key={index} className="text-sm text-gray-600">
                          {member.name} - {member.phone}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="text-blue-500 hover:text-blue-600">עריכה</button>
                    <button className="text-red-500 hover:text-red-600">מחיקה</button>
                  </div>
                </div>
                {team.uniqueLink && (
                  <div className="mt-2 text-sm text-gray-500">
                    קישור למשחק: {team.uniqueLink}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
} 