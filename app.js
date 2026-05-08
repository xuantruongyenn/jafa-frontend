const API_URL = "https://giapha-api-backend.onrender.com";

// --- Middleware: Lấy Header chứng thực ---
function getAuthHeaders() {
    const token = localStorage.getItem('giapha_token');
    if (!token) {
        alert("Bạn chưa đăng nhập! Đang quay lại trang đăng nhập...");
        window.location.href = "login.html"; 
    }
    return {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
    };
}

const app = {
    data: [], selectedId: null, chartInstance: null, zoomScale: 1,

    init() {
        document.getElementById('user-greeting').innerText = localStorage.getItem('giapha_username') || '';
        this.initZoomAndPan();
        this.initAvatarUpload(); 
        this.loadData();
    },

    logout() {
        localStorage.removeItem('giapha_token');
        localStorage.removeItem('giapha_username');
        window.location.href = "index.html";
    },

    // --- ĐỔI MẬT KHẨU ---
    openChangePassword() {
        document.getElementById('cp-old').value = '';
        document.getElementById('cp-new').value = '';
        document.getElementById('cp-confirm').value = '';
        document.getElementById('cp-error').classList.add('hidden');
        document.getElementById('change-password-modal').classList.remove('hidden');
    },

    closeChangePassword() {
        document.getElementById('change-password-modal').classList.add('hidden');
    },

    async submitChangePassword() {
        const oldPass = document.getElementById('cp-old').value;
        const newPass = document.getElementById('cp-new').value;
        const confirmPass = document.getElementById('cp-confirm').value;
        const errEl = document.getElementById('cp-error');

        errEl.classList.add('hidden');

        if (!oldPass || !newPass || !confirmPass) {
            errEl.innerText = 'Vui lòng điền đầy đủ thông tin!';
            return errEl.classList.remove('hidden');
        }
        if (newPass !== confirmPass) {
            errEl.innerText = 'Mật khẩu mới nhập lại không khớp!';
            return errEl.classList.remove('hidden');
        }
        if (newPass.length < 6) {
            errEl.innerText = 'Mật khẩu mới phải có ít nhất 6 ký tự!';
            return errEl.classList.remove('hidden');
        }

        try {
            const res = await fetch(`${API_URL}/change-password`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ old_password: oldPass, new_password: newPass })
            });

            if (res.status === 401) return this.logout();

            const data = await res.json();
            if (!res.ok) {
                errEl.innerText = data.detail || 'Có lỗi xảy ra!';
                return errEl.classList.remove('hidden');
            }

            this.closeChangePassword();
            alert('✅ Đổi mật khẩu thành công! Vui lòng đăng nhập lại.');
            this.logout();
        } catch (e) {
            errEl.innerText = 'Lỗi kết nối, vui lòng thử lại!';
            errEl.classList.remove('hidden');
        }
    },

    // --- AVATAR UPLOAD ---
    initAvatarUpload() {
        const fileInput = document.getElementById('f-avatar-input');
        if (!fileInput) return;
        
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            if (file.size > 300 * 1024) {
                alert("Ảnh quá lớn! Vui lòng chọn ảnh dưới 300KB.");
                e.target.value = '';
                return;
            }

            const img = new Image();
            const objectUrl = URL.createObjectURL(file);
            img.onload = () => {
                URL.revokeObjectURL(objectUrl);
                if (img.width > 300 || img.height > 300) {
                    alert(`Ảnh quá lớn (${img.width}×${img.height}px)! Vui lòng chọn ảnh tối đa 300×300px.`);
                    e.target.value = '';
                    return;
                }

                const reader = new FileReader();
                reader.onload = (ev) => {
                    const base64 = ev.target.result;
                    document.getElementById('f-avatar').value = base64;
                    const preview = document.getElementById('f-avatar-preview');
                    preview.src = base64;
                    preview.classList.remove('hidden');
                };
                reader.readAsDataURL(file);
            };
            img.src = objectUrl;
        });
    },
    
    // --- API CALLS ---
    async loadData() {
        try {
            const response = await fetch(`${API_URL}/get-members`, { headers: getAuthHeaders() });
            
            if (response.status === 401) {
                alert("Lỗi: Token của bạn bị từ chối bởi Server (401). Đang quay lại login...");
                return this.logout();
            }
            
            if (response.ok) {
                const dbData = await response.json();
                this.data = Array.isArray(dbData) ? dbData : [];
            }
        } catch (error) { 
            console.error("Lỗi:", error); 
        }
        this.render(); 
        this.updateStats();
    },

    async saveMember(event) {
        event.preventDefault();
        const id = document.getElementById('f-id').value;
        const newData = {
            id: id || Date.now().toString(),
            name: document.getElementById('f-name').value,
            gender: document.getElementById('f-gender').value,
            title: document.getElementById('f-title').value,
            birth: document.getElementById('f-birth').value,
            death: document.getElementById('f-death').value,
            spouse: document.getElementById('f-spouse').value,
            desc: document.getElementById('f-desc').value,
            parentId: document.getElementById('f-parentId').value || null,
            avatar: document.getElementById('f-avatar').value || null  
        };

        try {
            const response = await fetch(`${API_URL}/add-member`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(newData)
            });
            if (response.status === 401) return this.logout();
            if (!response.ok) throw new Error("Lỗi Server");
            
            await this.loadData();
            if (!id) this.selectMember(newData.id); 
            else alert("Lưu thành công!");
        } catch (e) { alert("Lỗi khi lưu dữ liệu!"); }
    },

    async deleteMember() {
        const id = String(document.getElementById('f-id').value);
        if(!id) return;
        if(this.data.some(p => String(p.parentId) === id)) {
            return alert("Vui lòng xóa dữ liệu con cháu trước.");
        }
        
        if(confirm("Bạn có chắc chắn muốn xóa?")) {
            try {
                const res = await fetch(`${API_URL}/delete-member/${id}`, { 
                    method: 'DELETE',
                    headers: getAuthHeaders() 
                });
                if(res.status === 401) return this.logout();
                
                const result = await res.json();
                if (result.error) return alert("Lỗi DB: " + result.error);
                
                await this.loadData();
                this.closeEditor();
            } catch(e) { alert("Lỗi mạng khi xóa!"); }
        }
    },

    async exportExcel() {
        try {
            const res = await fetch(`${API_URL}/export-excel`, {
                method: 'GET',
                headers: getAuthHeaders()
            });

            if (res.status === 401) return this.logout();
            if (!res.ok) throw new Error("Lỗi server khi xuất file");

            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'Gia_Pha.xlsx';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url); 
        } catch (e) {
            alert("Lỗi khi xuất Excel: " + e.message);
        }
    },

    // --- XUẤT SƠ ĐỒ CÂY RA PDF ---
    exportPDF() {
        const element = document.getElementById('family-tree-wrapper');
        if (!element || this.data.length === 0) {
            alert("Không có dữ liệu để xuất PDF!");
            return;
        }

        const originalScale = this.zoomScale;

        // Bước 1: Về zoom 100% để chụp đủ và nét
        this.setZoom(1);

        // Bước 2: Chờ transition zoom xong mới chụp (150ms)
        setTimeout(() => {
            // Lấy kích thước thực tế của toàn bộ cây gia phả (kể cả phần bị khuất)
            const fullWidth = element.scrollWidth;
            const fullHeight = element.scrollHeight;

            const opt = {
                margin: [20, 20, 20, 20],
                filename: `Gia_Pha_${localStorage.getItem('giapha_username') || 'Dong_Ho'}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: {
                    scale: 2,
                    useCORS: true,
                    allowTaint: true,
                    logging: false,
                    // Ép html2canvas lấy toàn bộ chiều rộng/cao thực tế
                    width: fullWidth,
                    height: fullHeight,
                    windowWidth: fullWidth,
                    windowHeight: fullHeight,
                    scrollX: 0,
                    scrollY: 0,
                    onclone: (clonedDoc) => {
                        // Áp dụng lại màu viền giới tính
                        clonedDoc.querySelectorAll('.gender-m').forEach(el => {
                            el.style.borderTop = '4px solid #3b82f6';
                        });
                        clonedDoc.querySelectorAll('.gender-f').forEach(el => {
                            el.style.borderTop = '4px solid #ec4899';
                        });
                        // Fix lỗi mất viền của từng người
                        clonedDoc.querySelectorAll('.tf-nc').forEach(el => {
                            el.style.backgroundColor = '#fafaf9';
                            el.style.border = '2px solid #a8a29e'; // Force hiển thị viền
                            el.style.borderRadius = '8px';
                            el.style.boxSizing = 'border-box';
                        });
                        clonedDoc.querySelectorAll('.tf-nc.selected').forEach(el => {
                            el.style.borderColor = '#d97706';
                            el.style.backgroundColor = '#fef3c7';
                        });
                    }
                },
                jsPDF: {
                    unit: 'px', 
                    // Linh hoạt tự tạo khổ giấy PDF vừa khít 100% với cây gia phả hiện tại
                    format: [fullWidth + 40, fullHeight + 40], 
                    orientation: fullWidth > fullHeight ? 'landscape' : 'portrait'
                }
            };

            html2pdf().set(opt).from(element).save()
                .then(() => {
                    this.setZoom(originalScale);
                })
                .catch(err => {
                    console.error('Lỗi xuất PDF:', err);
                    alert("Có lỗi xảy ra khi xuất PDF!");
                    this.setZoom(originalScale);
                });
        }, 150);
    },
    
    // --- MOBILE PANEL TOGGLE ---
    toggleMobilePanel(forceOpen = null) {
        const panel = document.getElementById('side-panel');
        if (!panel) return;
        if (forceOpen === true) {
            panel.classList.remove('translate-x-full');
        } else if (forceOpen === false) {
            panel.classList.add('translate-x-full');
        } else {
            panel.classList.toggle('translate-x-full');
        }
    },

    // --- ZOOM & PAN ---
    initZoomAndPan() {
        const container = document.getElementById('tree-container');
        if (!container) return;

        container.addEventListener('wheel', (e) => { 
            if (e.ctrlKey || e.metaKey) { 
                e.preventDefault(); 
                e.deltaY < 0 ? this.zoomIn() : this.zoomOut(); 
            } 
        }, { passive: false });
        
        let isDragging = false, startX, startY, scrollLeft, scrollTop;
        
        const startDrag = (x, y, target) => {
            if(target && target.closest('.tf-nc')) return; 
            isDragging = true;
            startX = x - container.offsetLeft;
            startY = y - container.offsetTop;
            scrollLeft = container.scrollLeft;
            scrollTop = container.scrollTop;
        };
        
        const stopDrag = () => { isDragging = false; };
        
        const drag = (x, y, e) => {
            if (!isDragging) return;
            if (e.cancelable) e.preventDefault();
            container.scrollLeft = scrollLeft - (x - container.offsetLeft - startX);
            container.scrollTop = scrollTop - (y - container.offsetTop - startY);
        };

        container.addEventListener('mousedown', (e) => startDrag(e.pageX, e.pageY, e.target));
        container.addEventListener('mouseleave', stopDrag);
        container.addEventListener('mouseup', stopDrag);
        container.addEventListener('mousemove', (e) => drag(e.pageX, e.pageY, e));

        container.addEventListener('touchstart', (e) => {
            if(e.touches.length === 1) startDrag(e.touches[0].pageX, e.touches[0].pageY, e.target);
        }, {passive: false});
        container.addEventListener('touchend', stopDrag);
        container.addEventListener('touchmove', (e) => {
            if(e.touches.length === 1 && isDragging) drag(e.touches[0].pageX, e.touches[0].pageY, e);
        }, {passive: false});
    },

    setZoom(scale) { 
        this.zoomScale = Math.min(Math.max(scale, 0.3), 2.5); 
        document.getElementById('family-tree-wrapper').style.transform = `scale(${this.zoomScale})`; 
        document.getElementById('zoom-level').innerText = Math.round(this.zoomScale * 100) + '%'; 
    },
    zoomIn()  { this.setZoom(this.zoomScale + 0.1); }, 
    zoomOut() { this.setZoom(this.zoomScale - 0.1); },

    // Fix: nút 🏠 giờ reset cả zoom LẪN scroll về đầu trang
    resetZoom() {
        this.setZoom(1);
        const container = document.getElementById('tree-container');
        if (container) {
            container.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
        }
    },

    // --- RENDER ---
    render() {
        const tw = document.getElementById('family-tree-wrapper'), es = document.getElementById('empty-state');
        if (this.data.length === 0) { tw.innerHTML = ''; es.classList.remove('hidden'); return; }
        es.classList.add('hidden');
        const roots = this.data.filter(p => !p.parentId || p.parentId === "null" || p.parentId === "");
        if(roots.length > 0) tw.innerHTML = `<div class="tf-tree text-center">${this.buildTreeHTML(roots)}</div>`;
        else tw.innerHTML = `<div class="bg-white p-6 rounded shadow border border-red-200 text-center mx-auto mt-10">⚠️ Mất liên kết Thủy Tổ. <button onclick="app.startAdding(null)" class="text-blue-500 underline font-bold mt-2">Tạo lại</button></div>`;
    },

    buildTreeHTML(nodes) {
        if (!nodes || !nodes.length) return '';
        let html = '<ul>';
        nodes.forEach(n => {
            const c = this.data.filter(p => p.parentId === n.id);
            const spouseColorClass = n.gender === 'M' ? 'text-pink-600' : 'text-blue-600';
            
            html += `<li><div class="tf-nc ${n.gender === 'M' ? 'gender-m' : 'gender-f'} ${this.selectedId === n.id ? 'selected' : ''}" onclick="app.selectMember('${n.id}')">
                <div class="font-bold flex flex-col items-center">
    ${n.avatar 
        ? `<img src="${n.avatar}" class="w-12 h-12 rounded-full object-cover mb-1 border-2 border-white shadow">`
        : `<span class="text-2xl mb-1">${n.gender === 'M' ? '👨' : '👩'}</span>`
    }
    <span>${n.name}</span>
</div>
                ${n.title ? `<div class="text-xs text-amber-700 bg-amber-50 inline-block px-1 rounded mt-1">${n.title}</div>` : ''}
                <div class="text-xs text-stone-500 mt-1">${n.birth || '?'} - ${n.death || 'Nay'}</div>
${n.spouse ? `<div class="text-xs ${spouseColorClass} mt-1">💑 ${n.spouse}</div>` : ''}
            </div>${this.buildTreeHTML(c)}</li>`;
        }); return html + '</ul>';
    },

    // --- UX/UI INTERACTION ---
    selectMember(id) {
        this.selectedId = id; 
        this.render(); 
        const m = this.data.find(p => p.id === id); 
        if (!m) return;
        
        document.getElementById('panel-stats').classList.add('hidden'); 
        document.getElementById('panel-editor').classList.remove('hidden');
        ['id','parentId','name','gender','title','birth','death','spouse','desc','avatar'].forEach(k => document.getElementById('f-'+k).value = m[k] || '');

        const preview = document.getElementById('f-avatar-preview');
        if (m.avatar) {
            preview.src = m.avatar;
            preview.classList.remove('hidden');
        } else {
            preview.src = '';
            preview.classList.add('hidden');
        }
        document.getElementById('f-avatar-input').value = '';
        document.getElementById('btn-add-child').classList.remove('hidden'); 
        document.getElementById('btn-delete').classList.remove('hidden');

        this.toggleMobilePanel(true);
    },

    startAdding(pId) {
        this.selectedId = null; 
        this.render();
        document.getElementById('panel-stats').classList.add('hidden'); 
        document.getElementById('panel-editor').classList.remove('hidden');
        document.getElementById('member-form').reset();
        document.getElementById('f-avatar').value = '';
        document.getElementById('f-avatar-preview').src = '';
        document.getElementById('f-avatar-preview').classList.add('hidden'); 
        document.getElementById('f-id').value = ''; 
        document.getElementById('f-parentId').value = pId || '';
        document.getElementById('btn-add-child').classList.add('hidden'); 
        document.getElementById('btn-delete').classList.add('hidden');

        this.toggleMobilePanel(true);
    },

    startAddingChild() { 
        const id = document.getElementById('f-id').value; 
        if(id) this.startAdding(id); 
    },

    closeEditor() { 
        this.selectedId = null; 
        this.render(); 
        document.getElementById('panel-editor').classList.add('hidden'); 
        document.getElementById('panel-stats').classList.remove('hidden'); 
        
        if (window.innerWidth < 768) { 
            this.toggleMobilePanel(false); 
        }
    },
    
    // --- STATISTICS ---
    updateStats() {
        const bloodCount = this.data.length;
        const inlawCount = this.data.filter(p => p.spouse && p.spouse.trim() !== '').length;
        const totalMembers = bloodCount + inlawCount;
        
        if (document.getElementById('total-members-badge')) document.getElementById('total-members-badge').innerText = totalMembers;
        if (document.getElementById('blood-members-badge')) document.getElementById('blood-members-badge').innerText = bloodCount;
        if (document.getElementById('inlaw-members-badge')) document.getElementById('inlaw-members-badge').innerText = inlawCount;

        let maxD = 0; 
        const getD = (id, cD) => { 
            maxD = Math.max(maxD, cD); 
            this.data.filter(p => p.parentId === id).forEach(c => getD(c.id, cD + 1)); 
        };
        this.data.filter(p => !p.parentId).forEach(r => getD(r.id, 1)); 
        document.getElementById('stat-generations').innerText = maxD;
        
        let maxY = 0; 
        this.data.forEach(p => { 
            if(p.birth && parseInt(p.birth) > maxY) maxY = parseInt(p.birth); 
        }); 
        document.getElementById('stat-latest-year').innerText = maxY || '-';
        
        let mBlood = 0, fBlood = 0, mInlaw = 0, fInlaw = 0, living = 0, deceased = 0;
        this.data.forEach(p => {
            if (p.gender === 'M') {
                mBlood++;
                if (p.spouse && p.spouse.trim() !== '') fInlaw++;
            } else if (p.gender === 'F') {
                fBlood++;
                if (p.spouse && p.spouse.trim() !== '') mInlaw++;
            }
            // Còn sống: không có năm mất (hoặc năm mất trống)
            if (!p.death || p.death.toString().trim() === '') living++;
            else deceased++;
        });

        // Vẽ bảng thống kê chi tiết
        const tableBody = document.getElementById('stat-table-body');
        if (tableBody) {
            const total = this.data.length || 1; // tránh chia cho 0
            const rows = [
                { label: '👨 Nam (ruột thịt)',  count: mBlood,   color: 'text-blue-600',  bg: 'bg-blue-50' },
                { label: '👩 Nữ (ruột thịt)',   count: fBlood,   color: 'text-pink-600',  bg: 'bg-pink-50' },
                { label: '🤝 Ruột thịt (tổng)', count: bloodCount, color: 'text-stone-700', bg: '' },
                { label: '💑 Dâu / Rể',         count: inlawCount, color: 'text-purple-600', bg: 'bg-purple-50' },
                { label: '🌱 Còn sống',          count: living,   color: 'text-emerald-600', bg: 'bg-emerald-50' },
                { label: '🕊 Đã mất',            count: deceased, color: 'text-stone-400',  bg: 'bg-stone-50' },
            ];
            tableBody.innerHTML = rows.map((r, i) => {
                const pct = total > 0 ? Math.round((r.count / total) * 100) : 0;
                const isDivider = i === 2; // dòng tổng ruột thịt — kẻ đậm hơn
                return `<tr class="${r.bg || 'bg-white'} ${isDivider ? 'border-t-2 border-stone-200' : ''}">
                    <td class="px-4 py-2.5 text-stone-700 font-medium">${r.label}</td>
                    <td class="px-3 py-2.5 text-center font-bold ${r.color} text-base">${r.count}</td>
                    <td class="px-3 py-2.5 text-center">
                        <div class="flex items-center gap-1.5 justify-center">
                            <div class="w-14 bg-stone-200 rounded-full h-1.5 overflow-hidden">
                                <div class="h-1.5 rounded-full bg-current ${r.color}" style="width:${pct}%"></div>
                            </div>
                            <span class="text-xs text-stone-400 w-7 text-right">${pct}%</span>
                        </div>
                    </td>
                </tr>`;
            }).join('');
        }

        if(this.chartInstance) { 
            this.chartInstance.data.labels = ['Nam (Ruột thịt)', 'Nữ (Ruột thịt)', 'Nam (Dâu rể)', 'Nữ (Dâu rể)'];
            this.chartInstance.data.datasets[0].data = [mBlood, fBlood, mInlaw, fInlaw];
            this.chartInstance.data.datasets[0].backgroundColor = ['#3b82f6', '#ec4899', '#93c5fd', '#fbcfe8']; 
            this.chartInstance.update(); 
        } else { 
            const chartCtx = document.getElementById('genderChart');
            if(chartCtx) {
                this.chartInstance = new Chart(chartCtx.getContext('2d'), { 
                    type: 'doughnut', 
                    data: { 
                        labels: ['Nam (Ruột thịt)', 'Nữ (Ruột thịt)', 'Nam (Dâu rể)', 'Nữ (Dâu rể)'], 
                        datasets: [{ 
                            data: [mBlood, fBlood, mInlaw, fInlaw], 
                            backgroundColor: ['#3b82f6', '#ec4899', '#93c5fd', '#fbcfe8'],
                            borderWidth: 2
                        }] 
                    }, 
                    options: { 
                        responsive: true, 
                        maintainAspectRatio: false, 
                        cutout: '60%', 
                        plugins: {
                            legend: { 
                                position: 'bottom',
                                labels: { boxWidth: 12, padding: 8, font: {size: 11} }
                            },
                            tooltip: {
                                callbacks: {
                                    label: function(context) {
                                        return ` ${context.label}: ${context.raw} người`;
                                    }
                                }
                            }
                        } 
                    } 
                });
            }
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('tree-container')) {
        app.init();
    }
});
