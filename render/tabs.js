;(function ($) {
  $.fn.extend({
    loading: function (option, param) {
      var $this = this;
      // 如果是 string 类型，说明是单个参数
      if (typeof option == 'string') {
        switch (option) {
          case 'hide':
            return this.each(function () {
              var id = $this.attr("id");
              var loadingId = id + "Loading";
              $("#" + loadingId).hide().detach();
              if ($("#" + id).css("display") == "none") {
                $("#" + id).show();
              }
            });
          case 'setLoadingText':
            return this.each(function () {
              var id = $this.attr("id");
              var loadingId = id + "Loading";
              $("#" + loadingId + "span").html(param);
            });
        }
      }

      var setting = {
        loadingText: "loading",
        loadingHide: false,
        opacity: 0.6,
        bgColor: "black",
        fontColor: "#fff",
        onLoadSuccess: null

      }

      var top = $this.offset().top;
      var left = $this.offset().left;
      var height = $this.height();
      var width = $this.width();

      //合并参数
      option = $.extend(setting, option);
      var id = $this.attr("id");
      var loadingId = id + "Loading";
      var divHtml = "<div  id='" + loadingId
          + "' style='background-color:" + option.bgColor
          + ";opacity:" + option.opacity
          + ";display:none;text-align:center;position:absolute;color:"
          + option.fontColor
          + ";' data-isHide='false'><span id='" + loadingId
          + "span'>" + option.loadingText + "</span></div>";

      if ($("#" + loadingId).length > 0) {
        var isHide = $("#" + loadingId).attr("data-isHide");
        if (isHide) {   //如果是显示的话
          return this;
        } else {
          $("#" + loadingId).remove();
        }
      }
      //将loadingdiv插入页面中
      $this.before(divHtml);

      //计算居中的padding值
      var loadingHeight = $("#" + loadingId).height();
      var paddingTop = height / 2 - loadingHeight;

      //判断原来的div是不是要隐藏
      if (option.loadingHide) {
        $this.hide();
      }
      $("#" + loadingId).offset(function (n, c) {
        newPos = new Object();
        newPos.left = left;
        newPos.top = top;
        return newPos;
      }).height(height - paddingTop).width(width).show();

      //居中
      $("#" + loadingId).css("padding-top", paddingTop + "px");

      //调用回调
      if (option.onLoadSuccess != null) {
        option.onLoadSuccess("这是参数");
      }
    }
  });
})(jQuery);
