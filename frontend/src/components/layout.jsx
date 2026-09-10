import {
  Layout,
  Button,
  theme,
  Input,
  Tooltip,
  Grid,
  Avatar,
  Badge,
  Dropdown,
  List,
  Spin,
  Menu,
  Modal,
} from 'antd';
import { useState, useEffect } from 'react';
import { Breadcrumb } from 'antd';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import API_URL from '../config';
import axios from 'axios';
import Sidebar from './sidebar';
import '../styles/navbar.css';
import {
  MenuUnfoldOutlined,
  MenuFoldOutlined,
  LogoutOutlined,
  SearchOutlined,
  UserOutlined,
  BellOutlined,
} from '@ant-design/icons';

const { Header, Sider, Content, Footer } = Layout;
const { useBreakpoint } = Grid;

const BasicLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState({ nombre: '', rol: '' });
  const [novedades, setNovedades] = useState([]);
  const [loadingNovedades, setLoadingNovedades] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  const {
    token: { colorBgContainer },
  } = theme.useToken();

  const screens = useBreakpoint();
  const navigate = useNavigate();
  const location = useLocation();
  const [tablaSeleccionada, setTablaSeleccionada] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  // 🍞 Lógica para generar las migajas de pan de forma automática según la URL actual
  const pathSnippets = location.pathname.split('/').filter((i) => i);
  const extraBreadcrumbItems = pathSnippets.map((snippet, index) => {
    const url = `/${pathSnippets.slice(0, index + 1).join('/')}`;
    return (
      <Breadcrumb.Item key={url}>
        <Link to={url}>{snippet.charAt(0).toUpperCase() + snippet.slice(1)}</Link>
      </Breadcrumb.Item>
    );
  });

  const breadcrumbItems = [
    <Breadcrumb.Item key="home">
      <Link to="/">Inicio</Link>
    </Breadcrumb.Item>,
    ...extraBreadcrumbItems,
  ];

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    navigate('/login');
  };

  const handleSearch = () => {
    const q = searchTerm.trim();
    if (q) {
      navigate(`/busqueda?q=${encodeURIComponent(q)}`);
      setSearchTerm('');
    }
  };

  const userMenu = (
    <Menu>
      <Menu.Item key="account" icon={<UserOutlined />} onClick={() => navigate('/perfil')}>
        Mi cuenta
      </Menu.Item>
      <Menu.Item key="logout" icon={<LogoutOutlined />} onClick={handleLogout}>
        Cerrar sesión
      </Menu.Item>
    </Menu>
  );

  const cargarNovedades = () => {
    setLoadingNovedades(true);
    axios
      .get(`${API_URL}/api/novedades`)
      .then((res) => {
        setNovedades(res.data);
      })
      .catch((err) => console.error('Error al obtener las novedades:', err))
      .finally(() => setLoadingNovedades(false));
  };

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }

    cargarNovedades();
  }, []);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        breakpoint="md"
        collapsedWidth={screens.xs ? 0 : 80}
        collapsible
        collapsed={collapsed}
        onCollapse={(value) => setCollapsed(value)}
      >
        <div className="Profile_info">
          {!collapsed && (
            <div className="profile-container">
              <img
                src="/logo1.png"
                alt="Profile"
                className={`Profile_image ${collapsed ? 'hidden' : ''}`}
                style={{ cursor: 'pointer' }}
                onClick={() => {
                  const rol = user?.rol?.toLowerCase().trim();
                  if (rol === 'administrador') {
                    navigate('/dashboard');
                  } else if (rol === 'auditor') {
                    navigate('/dashboardAuditor');
                  } else {
                    navigate('/');
                  }
                }}
              />
              <div className="profile-text">
                <h2 className="profile-brand">Audit RGA</h2>
                <p className="profile-slogan">Tu auditoría de confianza</p>
              </div>
            </div>
          )}
        </div>
        <Sidebar onSeleccion={setTablaSeleccionada} />
      </Sider>

      <Layout>
        <Header
          style={{
            padding: '0 16px',
            background: colorBgContainer,
            display: 'flex',
            flexDirection: screens.xs ? 'column' : 'row',
            alignItems: screens.xs ? 'flex-start' : 'center',
            justifyContent: 'space-between',
            gap: screens.xs ? '8px' : '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              style={{ fontSize: '20px' }}
            />

            <Input
              placeholder="Buscar..."
              prefix={<SearchOutlined />}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onPressEnter={handleSearch}
              style={{
                width: '100%',
                maxWidth: screens.xs ? '100%' : 400,
                borderRadius: '8px',
                backgroundColor: '#fff',
              }}
            />
          </div>

          {/* 🔔 Campanita con Modal */}
          <Badge count={novedades.length} overflowCount={9} style={{ marginRight: 16 }}>
            <BellOutlined
              style={{ fontSize: 20, cursor: 'pointer' }}
              onClick={() => setModalVisible(true)}
            />
          </Badge>
          <Modal
            title={null}
            open={modalVisible}
            onCancel={() => setModalVisible(false)}
            footer={null}
            centered
            width={600}
            style={{ top: 20 }}
            bodyStyle={{
              maxHeight: '60vh',
              overflowY: 'auto',
              padding: '24px',
              background: '#fdfdfd',
            }}
          >
            <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>📰 Novedades recientes</h2>

            <Spin spinning={loadingNovedades}>
              <List
                dataSource={novedades}
                locale={{ emptyText: 'No hay novedades nuevas.' }}
                renderItem={(item) => (
                  <List.Item
                    key={item.id}
                    style={{
                      background: '#fff',
                      padding: '16px',
                      borderRadius: '8px',
                      marginBottom: '12px',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
                    }}
                  >
                    <List.Item.Meta
                      title={
                        <div style={{ fontWeight: '600', fontSize: '16px', color: '#333' }}>
                          {item.titulo}
                        </div>
                      }
                      description={
                        <div style={{ fontSize: '14px', color: '#555', marginTop: '8px' }}>
                          {item.mensaje}
                        </div>
                      }
                    />
                  </List.Item>
                )}
              />
            </Spin>
          </Modal>


          {/* Avatar + Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}>
            <div style={{ textAlign: 'right', marginRight: '8px', lineHeight: '1.5' }}>
              <div style={{ fontWeight: 'bold', fontSize: '20px' }}>{user?.nombre || "Usuario"}</div>
              <div style={{ fontSize: '16px', color: 'gray', marginTop: '-4px' }}>{user.rol}</div>
            </div>
            <Dropdown overlay={userMenu} placement="bottomRight" trigger={['click']}>
              <Avatar
                size="large"
                icon={<UserOutlined />}
                style={{ cursor: 'pointer', backgroundColor: '#87d068' }}
              />
            </Dropdown>
          </div>
        </Header>

        <Content style={{ margin: '24px 0', background: '#fff', padding: 24 }}>
          {/* 🍞 Migajas de pan integradas de forma limpia */}
          <Breadcrumb style={{ marginBottom: '16px' }}>
            {breadcrumbItems}
          </Breadcrumb>
          <Outlet />
        </Content>

        <Footer style={{ textAlign: 'center' }}>
          ©2025 Gabriel Robledo. Todos los derechos reservados.
        </Footer>
      </Layout>
    </Layout>
  );
};

export default BasicLayout;