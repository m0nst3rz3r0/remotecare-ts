import { useMemo, useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { usePatientStore, selectVisiblePatients, selectSelectedPatient } from '../store/usePatientStore';
import { isDue } from '../services/clinical';
import PatientDetail from '../components/patient/PatientDetail';

export default function LTFUPage() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const patients = usePatientStore((s) => s.patients);

  const selectedPatient = usePatientStore((s) => selectSelectedPatient(s.patients, s.selectedId));

  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'ltfu' | 'overdue' | 'all'>('ltfu');
  const [smsConfigExpanded, setSmsConfigExpanded] = useState(false);
  const [language, setLanguage] = useState<'EN' | 'SW'>('EN');
  const [smsConfig, setSmsConfig] = useState({
    apiKey: '',
    apiSecret: '',
    senderId: '',
    baseUrl: '',
    enTemplate: '',
    swTemplate: ''
  });
  const [smsLog, setSmsLog] = useState([
    {
      id: 1,
      code: 'BRH001',
      phone: '+255754123456',
      message: 'Reminder: Your appointment is scheduled for tomorrow at Bukoba Regional Hospital...',
      status: 'sent',
      time: '10:30 AM'
    },
    {
      id: 2,
      code: 'BRH002',
      phone: '+255789654321',
      message: 'Mkumbusho: Matibabu yako yamepangwa kesho katika Hospitali ya Mkoa wa Bukoba...',
      status: 'failed',
      time: '09:15 AM'
    }
  ]);

  const visiblePatients = useMemo(
    () => selectVisiblePatients(patients, currentUser),
    [patients, currentUser],
  );

  const filteredPatients = useMemo(() => {
    let base = visiblePatients;
    
    if (filterTab === 'ltfu') {
      base = base.filter((p) => p.status === 'ltfu');
    } else if (filterTab === 'overdue') {
      base = base.filter((p) => p.status === 'active' && isDue(p));
    }
    // 'all' shows both LTFU and overdue

    const query = searchQuery.toLowerCase().trim();
    if (!query) return base;
    
    return base.filter((p) => 
      p.code.toLowerCase().includes(query) || 
      (p.phone ?? '').includes(query)
    );
  }, [visiblePatients, filterTab, searchQuery]);

  const sendSMS = (patientCode: string, phone: string) => {
    const template = language === 'EN' ? smsConfig.enTemplate : smsConfig.swTemplate;
    const message = template
      .replace('{patient_code}', patientCode)
      .replace('{facility}', currentUser?.sessionHospital || 'Bukoba Regional Hospital');
    
    const newLog = {
      id: smsLog.length + 1,
      code: patientCode,
      phone,
      message,
      status: 'sent',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    
    setSmsLog(prev => [newLog, ...prev]);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const clearSmsLog = () => {
    setSmsLog([]);
  };

  const saveSmsConfig = () => {
    // Save SMS configuration logic here
    console.log('Saving SMS config:', smsConfig);
    setSmsConfigExpanded(false);
  };

  return (
    <div style={{ background: '#f9f9f7', minHeight: '100vh', padding: '22px 24px' }}>
      {/* Header */}
      <div style={{
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        <div>
          <h2 style={{
            fontSize: '22px',
            fontWeight: 800,
            fontFamily: 'Syne, sans-serif',
            margin: 0,
            marginBottom: '4px'
          }}>
            LTFU & Overdue Patients
          </h2>
          <p style={{
            color: '#64748b',
            fontSize: '13px',
            margin: 0,
            fontFamily: 'Karla, sans-serif'
          }}>
            NCD Management Program · {currentUser?.sessionDistrict || 'Bukoba Municipal'}
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{
        display: 'flex',
        gap: '0',
        marginBottom: '16px'
      }}>
        {[
          { id: 'ltfu', label: 'LTFU', icon: '⚠️' },
          { id: 'overdue', label: 'Overdue', icon: '📅' },
          { id: 'all', label: 'All', icon: '📋' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilterTab(tab.id as any)}
            style={{
              padding: '12px 20px',
              border: 'none',
              background: filterTab === tab.id ? '#0d6e87' : 'transparent',
              color: filterTab === tab.id ? 'white' : '#64748b',
              fontSize: '12px',
              fontWeight: 600,
              fontFamily: 'Syne, sans-serif',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search Input */}
      <div style={{
        marginBottom: '16px',
        position: 'relative'
      }}>
        <span style={{
          position: 'absolute',
          left: '12px',
          top: '50%',
          transform: 'translateY(-50%)',
          fontSize: '14px'
        }}>
          🔍
        </span>
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search…"
          style={{
            width: '100%',
            padding: '10px 12px 10px 40px',
            border: '1px solid #d4e9ef',
            borderRadius: '6px',
            fontSize: '12px',
            fontFamily: 'Karla, sans-serif',
            background: 'white'
          }}
        />
      </div>

      {/* SMS Configuration Card */}
      <div style={{
        background: 'white',
        border: '1px solid #d4e9ef',
        borderRadius: '10px',
        marginBottom: '16px',
        boxShadow: '0 2px 8px rgba(15,31,38,.06)',
        overflow: 'hidden'
      }}>
        <button
          onClick={() => setSmsConfigExpanded(!smsConfigExpanded)}
          style={{
            width: '100%',
            padding: '12px 16px',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontFamily: 'Syne, sans-serif',
            fontSize: '12px',
            fontWeight: 600,
            color: '#0f1f26'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '16px' }}>📡</span>
            SMS Configuration
          </div>
          <span style={{ fontSize: '12px' }}>
            {smsConfigExpanded ? '▲' : '▼'}
          </span>
        </button>
        
        {smsConfigExpanded && (
          <div style={{
            padding: '16px',
            borderTop: '1px solid #d4e9ef',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px'
          }}>
            <div>
              <label style={{
                display: 'block',
                fontSize: '10px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                color: '#64748b',
                marginBottom: '4px',
                fontFamily: 'Syne, sans-serif'
              }}>
                API Key
              </label>
              <input
                value={smsConfig.apiKey}
                onChange={(e) => setSmsConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  border: '1px solid #d4e9ef',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontFamily: 'Karla, sans-serif'
                }}
              />
            </div>
            
            <div>
              <label style={{
                display: 'block',
                fontSize: '10px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                color: '#64748b',
                marginBottom: '4px',
                fontFamily: 'Syne, sans-serif'
              }}>
                API Secret
              </label>
              <input
                value={smsConfig.apiSecret}
                onChange={(e) => setSmsConfig(prev => ({ ...prev, apiSecret: e.target.value }))}
                type="password"
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  border: '1px solid #d4e9ef',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontFamily: 'Karla, sans-serif'
                }}
              />
            </div>
            
            <div>
              <label style={{
                display: 'block',
                fontSize: '10px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                color: '#64748b',
                marginBottom: '4px',
                fontFamily: 'Syne, sans-serif'
              }}>
                Sender ID
              </label>
              <input
                value={smsConfig.senderId}
                onChange={(e) => setSmsConfig(prev => ({ ...prev, senderId: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  border: '1px solid #d4e9ef',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontFamily: 'Karla, sans-serif'
                }}
              />
            </div>
            
            <div>
              <label style={{
                display: 'block',
                fontSize: '10px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                color: '#64748b',
                marginBottom: '4px',
                fontFamily: 'Syne, sans-serif'
              }}>
                Base URL
              </label>
              <input
                value={smsConfig.baseUrl}
                onChange={(e) => setSmsConfig(prev => ({ ...prev, baseUrl: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  border: '1px solid #d4e9ef',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontFamily: 'Karla, sans-serif'
                }}
              />
            </div>
            
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{
                display: 'block',
                fontSize: '10px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                color: '#64748b',
                marginBottom: '4px',
                fontFamily: 'Syne, sans-serif'
              }}>
                EN Template
              </label>
              <textarea
                value={smsConfig.enTemplate}
                onChange={(e) => setSmsConfig(prev => ({ ...prev, enTemplate: e.target.value }))}
                rows={2}
                placeholder="Dear {patient_code}, your appointment is scheduled at {facility}..."
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  border: '1px solid #d4e9ef',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontFamily: 'Karla, sans-serif',
                  resize: 'vertical'
                }}
              />
            </div>
            
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{
                display: 'block',
                fontSize: '10px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                color: '#64748b',
                marginBottom: '4px',
                fontFamily: 'Syne, sans-serif'
              }}>
                SW Template
              </label>
              <textarea
                value={smsConfig.swTemplate}
                onChange={(e) => setSmsConfig(prev => ({ ...prev, swTemplate: e.target.value }))}
                rows={2}
                placeholder="Mpendwa {patient_code}, matibabu yako yamepangwa {facility}..."
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  border: '1px solid #d4e9ef',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontFamily: 'Karla, sans-serif',
                  resize: 'vertical'
                }}
              />
            </div>
            
            <div style={{ gridColumn: '1 / -1' }}>
              <button
                onClick={saveSmsConfig}
                style={{
                  background: '#0d6e87',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  fontSize: '12px',
                  fontWeight: 600,
                  fontFamily: 'Syne, sans-serif',
                  cursor: 'pointer'
                }}
              >
                Save Configuration
              </button>
            </div>
            
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{
                fontSize: '11px',
                color: '#64748b',
                fontFamily: 'Karla, sans-serif',
                background: '#f0fafc',
                padding: '8px 12px',
                borderRadius: '4px',
                border: '1px solid #d4e9ef'
              }}>
                ℹ️ Supported providers: Twilio, Africa's Talking, SMSHub
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '300px 1fr',
        gap: '20px'
      }}>
        {/* LEFT PANEL - Patient List */}
        <div style={{
          background: 'white',
          border: '1px solid #d4e9ef',
          borderRadius: '10px',
          boxShadow: '0 2px 8px rgba(15,31,38,.06)',
          overflow: 'hidden'
        }}>
          <div style={{
            background: '#0f1f26',
            padding: '12px 16px',
            fontFamily: 'Syne, sans-serif',
            fontSize: '12px',
            fontWeight: 700,
            color: 'white',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            Patient List ({filteredPatients.length})
          </div>
          
          <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
            {filteredPatients.map((patient) => (
              <div key={patient.id} style={{
                padding: '12px 16px',
                borderBottom: '1px solid rgba(212,233,239,0.3)',
                fontFamily: 'Karla, sans-serif'
              }}>
                {/* Patient Code */}
                <div style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  background: '#0d6e87',
                  color: 'white',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '10px',
                  fontWeight: 600,
                  display: 'inline-block',
                  marginBottom: '8px'
                }}>
                  {patient.code}
                </div>
                
                {/* Condition and Status Chips */}
                <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                  <span style={{
                    background: patient.cond === 'DM' ? '#e4f6fb' : 
                              patient.cond === 'DM+HTN' ? '#ede9fe' : '#dcfce7',
                    color: patient.cond === 'DM' ? '#0d6e87' : 
                           patient.cond === 'DM+HTN' ? '#7c3aed' : '#16a34a',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '9px',
                    fontWeight: 600
                  }}>
                    {patient.cond}
                  </span>
                  <span style={{
                    background: patient.status === 'ltfu' ? '#fee2e2' : '#fef3c7',
                    color: patient.status === 'ltfu' ? '#dc2626' : '#d97706',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '9px',
                    fontWeight: 600
                  }}>
                    {patient.status === 'ltfu' ? 'LTFU' : 'Overdue'}
                  </span>
                </div>
                
                {/* Phone Number */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginBottom: '8px',
                  fontSize: '11px',
                  color: '#64748b'
                }}>
                  <span>📞</span>
                  {patient.phone || 'No phone'}
                </div>
                
                {/* SMS Action Row */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  flexWrap: 'wrap'
                }}>
                  {/* Language Toggle */}
                  <div style={{
                    display: 'flex',
                    background: '#f4f4f2',
                    borderRadius: '4px',
                    overflow: 'hidden'
                  }}>
                    {(['EN', 'SW'] as const).map((lang) => (
                      <button
                        key={lang}
                        onClick={() => setLanguage(lang)}
                        style={{
                          padding: '4px 8px',
                          border: 'none',
                          background: language === lang ? '#0d6e87' : 'transparent',
                          color: language === lang ? 'white' : '#64748b',
                          fontSize: '9px',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        {lang}
                      </button>
                    ))}
                  </div>
                  
                  {/* Send SMS Button */}
                  <button
                    onClick={() => patient.phone && sendSMS(patient.code, patient.phone)}
                    disabled={!patient.phone}
                    style={{
                      background: patient.phone ? '#0d6e87' : '#f4f4f2',
                      color: patient.phone ? 'white' : '#64748b',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '4px 8px',
                      fontSize: '9px',
                      fontWeight: 600,
                      cursor: patient.phone ? 'pointer' : 'not-allowed',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    📱 Send SMS
                  </button>
                  
                  {/* Copy Button */}
                  <button
                    onClick={() => copyToClipboard(patient.phone || '')}
                    style={{
                      background: 'transparent',
                      color: '#64748b',
                      border: '1px solid #d4e9ef',
                      borderRadius: '4px',
                      padding: '4px 8px',
                      fontSize: '9px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    📋 Copy
                  </button>
                </div>
              </div>
            ))}
            
            {filteredPatients.length === 0 && (
              <div style={{
                padding: '40px 16px',
                textAlign: 'center',
                color: '#64748b',
                fontSize: '12px',
                fontFamily: 'Karla, sans-serif'
              }}>
                No patients found matching the current filters.
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL - Patient Detail */}
        <div style={{
          background: 'white',
          border: '1px solid #d4e9ef',
          borderRadius: '10px',
          boxShadow: '0 2px 8px rgba(15,31,38,.06)',
          overflow: 'hidden'
        }}>
          <div style={{
            background: '#0f1f26',
            padding: '12px 16px',
            fontFamily: 'Syne, sans-serif',
            fontSize: '12px',
            fontWeight: 700,
            color: 'white',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            Patient Details
          </div>
          
          <div style={{ padding: '16px' }}>
            {selectedPatient ? (
              <PatientDetail />
            ) : (
              <div style={{
                textAlign: 'center',
                color: '#64748b',
                fontSize: '12px',
                fontFamily: 'Karla, sans-serif',
                padding: '40px'
              }}>
                Select a patient from the list to view details
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SMS Log */}
      <div style={{
        background: 'white',
        border: '1px solid #d4e9ef',
        borderRadius: '10px',
        boxShadow: '0 2px 8px rgba(15,31,38,.06)',
        overflow: 'hidden',
        marginTop: '20px'
      }}>
        <div style={{
          background: '#0f1f26',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{
            fontFamily: 'Syne, sans-serif',
            fontSize: '12px',
            fontWeight: 700,
            color: 'white',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <span>📜</span>
            SMS Log
          </div>
          <button
            onClick={clearSmsLog}
            style={{
              background: 'transparent',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '4px',
              padding: '4px 12px',
              fontSize: '10px',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'Syne, sans-serif'
            }}
          >
            Clear Log
          </button>
        </div>
        
        <div style={{ overflowX: 'auto' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '11px',
            fontFamily: 'Karla, sans-serif'
          }}>
            <thead>
              <tr style={{
                background: '#f4f4f2',
                color: '#0f1f26'
              }}>
                <th style={{
                  padding: '8px 12px',
                  textAlign: 'left',
                  fontSize: '10px',
                  fontWeight: 600,
                  fontFamily: 'Syne, sans-serif',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>Code</th>
                <th style={{
                  padding: '8px 12px',
                  textAlign: 'left',
                  fontSize: '10px',
                  fontWeight: 600,
                  fontFamily: 'Syne, sans-serif',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>Phone</th>
                <th style={{
                  padding: '8px 12px',
                  textAlign: 'left',
                  fontSize: '10px',
                  fontWeight: 600,
                  fontFamily: 'Syne, sans-serif',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>Message Preview</th>
                <th style={{
                  padding: '8px 12px',
                  textAlign: 'left',
                  fontSize: '10px',
                  fontWeight: 600,
                  fontFamily: 'Syne, sans-serif',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>Status</th>
                <th style={{
                  padding: '8px 12px',
                  textAlign: 'left',
                  fontSize: '10px',
                  fontWeight: 600,
                  fontFamily: 'Syne, sans-serif',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>Time</th>
              </tr>
            </thead>
            <tbody>
              {smsLog.map((log) => (
                <tr key={log.id} style={{
                  borderBottom: '1px solid rgba(212,233,239,0.3)'
                }}>
                  <td style={{
                    padding: '8px 12px',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontWeight: 600,
                    color: '#0d6e87'
                  }}>
                    {log.code}
                  </td>
                  <td style={{
                    padding: '8px 12px',
                    fontFamily: 'JetBrains Mono, monospace',
                    color: '#64748b'
                  }}>
                    {log.phone}
                  </td>
                  <td style={{
                    padding: '8px 12px',
                    color: '#0f1f26',
                    maxWidth: '300px'
                  }}>
                    <div style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {log.message}
                    </div>
                  </td>
                  <td style={{
                    padding: '8px 12px'
                  }}>
                    <span style={{
                      background: log.status === 'sent' ? '#dcfce7' : '#fee2e2',
                      color: log.status === 'sent' ? '#16a34a' : '#dc2626',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontSize: '9px',
                      fontWeight: 600,
                      textTransform: 'uppercase'
                    }}>
                      {log.status}
                    </span>
                  </td>
                  <td style={{
                    padding: '8px 12px',
                    fontFamily: 'JetBrains Mono, monospace',
                    color: '#64748b'
                  }}>
                    {log.time}
                  </td>
                </tr>
              ))}
              {smsLog.length === 0 && (
                <tr>
                  <td colSpan={5} style={{
                    padding: '40px',
                    textAlign: 'center',
                    color: '#64748b',
                    fontSize: '12px'
                  }}>
                    No SMS messages sent yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

